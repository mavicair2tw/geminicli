import streamlit as st
import yfinance as yf
import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import google.generativeai as genai
import os
from datetime import timedelta
from dotenv import load_dotenv

# 加載 .env 檔案中的環境變數 (本地開發使用)
load_dotenv()

# 頁面配置
st.set_page_config(page_title="台股 Gemini AI 分析師 Pro", layout="wide")

# --- API KEY 自動讀取邏輯 ---
def get_api_key():
    # 1. 優先從 Streamlit Secrets 讀取 (雲端部署用)
    if "GEMINI_API_KEY" in st.secrets:
        return st.secrets["GEMINI_API_KEY"]
    # 2. 從環境變數讀取 (本地 .env 用)
    env_key = os.getenv("GEMINI_API_KEY")
    if env_key and env_key != "您的_API_KEY_寫在這裡":
        return env_key
    return None

api_key = get_api_key()

# 取得可用模型清單
@st.cache_resource
def get_verified_models(_api_key):
    try:
        genai.configure(api_key=_api_key)
        models = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
        return models
    except Exception:
        return []

def calculate_indicators(df):
    if len(df) < 10: return df
    df['MA5'] = df['Close'].rolling(window=5).mean()
    df['MA10'] = df['Close'].rolling(window=10).mean()
    delta = df['Close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=6).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=6).mean()
    rs = gain / loss
    df['RSI'] = 100 - (100 / (1 + rs))
    return df

# 側邊欄
st.sidebar.title("🚀 AI 監控設定")

if api_key:
    st.sidebar.success("🔑 API Key 已自動載入")
else:
    api_key = st.sidebar.text_input("輸入 Gemini API Key", type="password")

if api_key:
    model_options = get_verified_models(api_key)
    selected_model = st.sidebar.selectbox("AI 模型", options=model_options if model_options else ["偵測中..."])
    
    raw_stock_input = st.sidebar.text_input("台股代號 (自動帶入.TW)", value="2330, 00981A")
    
    st.sidebar.markdown("---")
    interval_map = {"1分": "1m", "5分": "5m", "15分": "15m", "30分": "30m", "60分": "60m", "日線": "1d"}
    selected_interval = interval_map[st.sidebar.selectbox("頻率", list(interval_map.keys()))]
    
    period_options = {"15分": "slice_15m", "30分": "slice_30m", "1小時": "slice_1h", "1天": "1d", "1週": "5d", "1月": "1mo"}
    selected_period_label = st.sidebar.selectbox("區間", list(period_options.keys()), index=3)
    selected_period_val = period_options[selected_period_label]

    # 處理代號
    stock_ids = [f"{s.strip().upper()}.TW" if "." not in s.strip() else s.strip().upper() for s in raw_stock_input.split(',') if s.strip()]

    # 主畫面
    st.title("📈 台股 Gemini AI 投資分析師")
    
    if stock_ids:
        tabs = st.tabs(stock_ids + ["📊 綜合配置"])
        stock_data_dict = {}

        for i, stock_id in enumerate(stock_ids):
            with tabs[i]:
                try:
                    fetch_p = "5d" if selected_interval == "1m" else "1mo" # 預抓足夠長度供切片
                    stock = yf.Ticker(stock_id)
                    df = stock.history(period=fetch_p, interval=selected_interval)
                    
                    if df.empty:
                        st.error(f"無 {stock_id} 數據")
                        continue

                    # 切片邏輯
                    if "slice_" in selected_period_val:
                        mins = 60 if "h" in selected_period_val else int(selected_period_val.split("_")[1].replace("m",""))
                        df = df.loc[df.index[-1] - timedelta(minutes=mins):]

                    df = calculate_indicators(df)
                    stock_data_dict[stock_id] = df

                    # 圖表
                    fig = make_subplots(rows=2, cols=1, shared_xaxes=True, vertical_spacing=0.05, row_width=[0.2, 0.8])
                    fig.add_trace(go.Candlestick(x=df.index, open=df['Open'], high=df['High'], low=df['Low'], close=df['Close'], name='K線'), row=1, col=1)
                    fig.add_trace(go.Scatter(x=df.index, y=df['MA5'], name='MA5', line=dict(color='orange', width=1)), row=1, col=1)
                    fig.add_trace(go.Scatter(x=df.index, y=df['RSI'], name='RSI', line=dict(color='purple')), row=2, col=1)
                    fig.update_layout(xaxis_rangeslider_visible=False, height=500)
                    st.plotly_chart(fig, use_container_width=True)

                    c1, c2 = st.columns(2)
                    with c1:
                        if st.button(f"🎯 短線 AI 分析 ({stock_id})"):
                            model = genai.GenerativeModel(selected_model)
                            res = model.generate_content(f"分析 {stock_id} 近期數據：\n{df[['Close','Volume']].tail(15).to_string()}\n用繁體中文給予當下操作建議。")
                            st.info(res.text)
                    with c2:
                        if st.button(f"💡 基本面分析 ({stock_id})"):
                            model = genai.GenerativeModel(selected_model)
                            res = model.generate_content(f"分析 {stock_id} 的投資價值與風險。用繁體中文。")
                            st.info(res.text)
                except Exception as e:
                    st.error(f"錯誤: {e}")
else:
    st.info("👋 請在側邊欄輸入 API Key 或設定雲端 Secrets 以啟動分析功能。")
