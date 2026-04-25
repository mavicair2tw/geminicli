import google.generativeai as genai
import json
import re

class PlannerAgent:
    def __init__(self, api_key):
        self.api_key = api_key
        if api_key:
            genai.configure(api_key=api_key)

    def create_plan(self, user_input, available_skills, model_name="gemini-1.5-flash-latest"):
        """
        根據使用者輸入與可用技能，產生一個執行計畫
        """
        # 確保模型名稱正確
        full_model_name = model_name if model_name.startswith("models/") else f"models/{model_name}"
        model = genai.GenerativeModel(full_model_name)

        skills_desc = "\n".join([f"- {name}: {desc}" for name, desc in available_skills.items()])
        
        prompt = f"""
        你是一位專業的 OpenClaw 任務規劃官。使用者的目標是："{user_input}"
        目前系統可用的技能 (Skills) 如下：
        {skills_desc}
        - final_answer: 當所有步驟完成時，向使用者回報最終結果。

        請將任務拆解為數個步驟並以 JSON 格式回覆：
        [
            {{"step": 1, "skill": "技能名稱", "task": "具體任務內容", "para": {{"參數": "值"}}}}
        ]
        最後一個步驟必須是 final_answer。只輸出 JSON。
        """

        try:
            response = model.generate_content(prompt)
            json_match = re.search(r'\[.*\]', response.text, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            return [{"step": 1, "skill": "error", "task": f"無法解析 JSON: {response.text[:100]}", "para": {}}]
        except Exception as e:
            return [{"step": 1, "skill": "error", "task": f"規劃失敗: {str(e)}", "para": {}}]
