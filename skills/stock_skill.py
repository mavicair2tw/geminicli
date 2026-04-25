import yfinance as yf

def stock_analyst(stock_id):
    """
    OpenClaw 技能：分析台股數據 (包含歷史 K 線)
    """
    full_id = stock_id.upper()
    if "." not in full_id:
        full_id = f"{full_id}.TW"
    
    try:
        stock = yf.Ticker(full_id)
        # 抓取 1 個月資料以繪圖
        df = stock.history(period="1mo")
        
        if df.empty:
            return {"status": "error", "message": f"找不到 {full_id} 數據"}
        
        current_price = df['Close'].iloc[-1]
        prev_price = df['Close'].iloc[-2]
        change = current_price - prev_price
        
        return {
            "status": "success",
            "type": "stock_data", # 標記資料類型
            "data": {
                "stock_id": full_id,
                "current_price": round(current_price, 2),
                "change": round(change, 2),
                "history": df, # 傳回 DataFrame 供繪圖
                "msg": f"{full_id} 目前價格 {current_price:.2f} (昨收 {prev_price:.2f})"
            }
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}
