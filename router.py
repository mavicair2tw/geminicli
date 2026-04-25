import google.generativeai as genai
import os

class IntentRouter:
    def __init__(self, gemini_api_key):
        self.gemini_key = gemini_api_key
        if gemini_api_key:
            genai.configure(api_key=gemini_api_key)

    def route(self, user_input):
        prompt = user_input.lower()
        if any(word in prompt for word in ["寫程式", "bug", "優化", "架構"]):
            return "CLAUDE_ENGINE", "建議使用 Claude 進行深度程式規劃。"
        if any(word in prompt for word in ["股票", "分析", "郵件", "日曆"]):
            return "GEMINI_ENGINE", "切換至 Gemini 執行市場分析與生態任務。"
        if any(word in prompt for word in ["密碼", "私鑰", "本機"]):
            return "LOCAL_ENGINE", "為了安全，此任務建議在 Local Model 執行。"
        return "GEMINI_ENGINE", "預設使用 Gemini Flash 處理。"

    def get_gemini_model(self, model_name="gemini-1.5-flash-latest"):
        # 確保使用完整名稱
        full_name = model_name if model_name.startswith("models/") else f"models/{model_name}"
        return genai.GenerativeModel(full_name)
