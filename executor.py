from skills.stock_skill import stock_analyst

class OpenClawExecutor:
    def __init__(self):
        self.skill_registry = {
            "stock_analyst": stock_analyst
        }

    def run_step(self, step):
        skill_name = step.get("skill")
        para = step.get("para", {})
        
        if skill_name == "final_answer":
            return {"status": "final", "content": step.get("task")}
        
        if skill_name in self.skill_registry:
            # 容錯處理：有些 AI 會把參數寫成 stock_id, 有些會寫成 stock_symbol 或 symbol
            stock_id = para.get("stock_id") or para.get("stock_symbol") or para.get("symbol")
            
            if stock_id:
                return self.skill_registry[skill_name](stock_id)
            else:
                return {"status": "error", "message": f"計畫中缺少必要參數 (stock_id)"}
        
        return {"status": "error", "message": f"找不到對應技能: {skill_name}"}
