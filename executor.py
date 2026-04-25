from skills.stock_skill import stock_analyst

class OpenClawExecutor:
    def __init__(self):
        # 註冊可用技能函數
        self.skill_registry = {
            "stock_analyst": stock_analyst
        }

    def run_step(self, step):
        skill_name = step.get("skill")
        para = step.get("para", {})
        
        if skill_name == "final_answer":
            return {"status": "final", "content": step.get("task")}
        
        if skill_name in self.skill_registry:
            # 執行技能
            # 這裡我們假設 stock_analyst 需要 stock_id 參數
            if "stock_id" in para:
                return self.skill_registry[skill_name](para["stock_id"])
            else:
                return {"status": "error", "message": f"缺少參數: {para}"}
        
        return {"status": "error", "message": f"未知的技能: {skill_name}"}
