import streamlit as st
from router import IntentRouter
from planner import PlannerAgent
from executor import OpenClawExecutor
import google.generativeai as genai
import plotly.graph_objects as go
import os
from dotenv import load_dotenv

load_dotenv()
st.set_page_config(page_title="OpenClaw Gateway Pro", layout="wide", page_icon="🐾")

gemini_key = os.getenv("GEMINI_API_KEY")

@st.cache_resource
def get_verified_models(api_key):
    try:
        genai.configure(api_key=api_key)
        models = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
        return models
    except:
        return ["models/gemini-1.5-flash"]

router = IntentRouter(gemini_key)
planner = PlannerAgent(gemini_key)
executor = OpenClawExecutor()

AVAILABLE_SKILLS = {
    "stock_analyst": "分析台股數據，顯示即時股價與一個月內的 K 線圖走勢。",
}

if "messages" not in st.session_state: st.session_state.messages = []
if "current_plan" not in st.session_state: st.session_state.current_plan = None

# --- 輔助函數：繪製 K 線圖 ---
def render_k_chart(stock_id, df):
    fig = go.Figure(data=[go.Candlestick(
        x=df.index, open=df['Open'], high=df['High'], 
        low=df['Low'], close=df['Close'], name="K線"
    )])
    fig.update_layout(
        title=f"{stock_id} 歷史走勢 (近一月)",
        xaxis_rangeslider_visible=False,
        height=400,
        margin=dict(t=30, b=10, l=10, r=10)
    )
    st.plotly_chart(fig, use_container_width=True)

st.title("🐾 OpenClaw Gateway")

with st.sidebar:
    st.subheader("📡 系統狀態")
    if gemini_key:
        st.success("Gemini: ✅ 已連線")
        model_list = get_verified_models(gemini_key)
        selected_model = st.selectbox("核心模型", model_list)
    else:
        st.error("Gemini: ❌ 未設定")
        selected_model = "models/gemini-1.5-flash"
    
    if st.button("🗑 清除對話"):
        st.session_state.messages = []
        st.session_state.current_plan = None
        st.rerun()

# --- 渲染歷史訊息 (支援富文本與圖表) ---
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        if message.get("type") == "text":
            st.markdown(message["content"])
        elif message.get("type") == "stock_result":
            # 渲染股價指標
            st.metric(message["stock_id"], f"{message['price']}", f"{message['change']}")
            # 渲染 K 線圖
            render_k_chart(message["stock_id"], message["df"])
            st.markdown(message["content"])

# --- 處理輸入 ---
if prompt := st.chat_input("輸入指令 (例如: 分析 2330)"):
    st.session_state.messages.append({"role": "user", "content": prompt, "type": "text"})
    st.rerun()

# 顯示 Assistant 規劃邏輯
if len(st.session_state.messages) > 0 and st.session_state.messages[-1]["role"] == "user" and not st.session_state.current_plan:
    with st.chat_message("assistant"):
        user_msg = st.session_state.messages[-1]["content"]
        engine, reason = router.route(user_msg)
        with st.status("🧠 **Planner Agent 規劃中...**") as status:
            plan = planner.create_plan(user_msg, AVAILABLE_SKILLS, model_name=selected_model)
            st.session_state.current_plan = plan
            status.update(label="✅ 計畫規劃完成", state="complete")
        st.rerun()

# --- 執行確認區 (Permission Gate) ---
if st.session_state.current_plan:
    with st.chat_message("assistant"):
        st.warning("⚠️ **Permission Gate**：AI 請求執行計畫。")
        st.json(st.session_state.current_plan)
        
        if st.button("🚀 確認並執行計畫"):
            for step in st.session_state.current_plan:
                res = executor.run_step(step)
                
                if isinstance(res, dict) and res.get("status") == "success":
                    # 將帶有數據的結果存入 messages
                    st.session_state.messages.append({
                        "role": "assistant",
                        "type": "stock_result",
                        "stock_id": res['data']['stock_id'],
                        "price": res['data']['current_price'],
                        "change": res['data']['change'],
                        "df": res['data']['history'],
                        "content": res['data']['msg']
                    })
                elif isinstance(res, dict) and res.get("status") == "final":
                    st.session_state.messages.append({
                        "role": "assistant",
                        "type": "text",
                        "content": f"**任務完成**: {res['content']}"
                    })
            
            st.session_state.current_plan = None
            st.rerun()
