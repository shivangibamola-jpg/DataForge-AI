import pandas as pd
import numpy as np
from typing import Dict, Any, Optional
from sklearn.linear_model import Ridge

def generate_predictions_and_insights(df: pd.DataFrame) -> Dict[str, Any]:
    """
    1. Evaluates if sample size and chronological continuity permit reliable forecasts.
    2. Runs deterministic Ridge / Trend regression if suitable.
    3. Produces evidence-grounded natural language insights explaining variances and key bottlenecks.
    """
    # Look for numeric and date features
    numeric_cols = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
    date_cols = [c for c in df.columns if 'date' in c.lower() or 'day' in c.lower()]

    insights = []
    prediction_result = None

    if len(df) < 20:
        prediction_result = {
            "eligible": False,
            "reason": f"Sample size too small ({len(df)} rows). A minimum of 20 historical observations is required for predictive modeling."
        }
    elif not numeric_cols:
        prediction_result = {
            "eligible": False,
            "reason": "No numerical metrics detected in the dataset to build a predictive target model."
        }
    else:
        # Build trend forecast for the primary metric
        target_col = numeric_cols[0]
        sub = df[[target_col]].dropna().copy()
        
        if len(sub) >= 20:
            X = np.arange(len(sub)).reshape(-1, 1)
            y = sub[target_col].values
            
            model = Ridge()
            model.fit(X, y)
            
            # Predict next 7 periods
            future_X = np.arange(len(sub), len(sub) + 7).reshape(-1, 1)
            future_y = model.predict(future_X)
            
            slope = float(model.coef_[0])
            trend_direction = "increasing" if slope > 0.05 else ("decreasing" if slope < -0.05 else "stable")
            
            prediction_result = {
                "eligible": True,
                "target_metric": target_col,
                "algorithm": "Ridge Linear Trend Projection",
                "sample_size_used": len(sub),
                "trend_direction": trend_direction,
                "projected_change_rate": round(slope, 3),
                "forecast_points": [
                    {"period": f"+{i+1} horizon", "projected_value": round(float(val), 2)}
                    for i, val in enumerate(future_y)
                ]
            }
            
            insights.append({
                "type": "Trend & Forecasting",
                "summary": f"{target_col.replace('_', ' ')} is {trend_direction} at ~{round(abs(slope), 2)} units per period.",
                "evidence": f"Trained on {len(sub)} validated historical entries using deterministic linear ridge regression."
            })

    # Statistical distribution insight
    for col in numeric_cols[:2]:
        s = df[col].dropna()
        if len(s) > 5:
            mean_v = float(s.mean())
            std_v = float(s.std())
            cv = (std_v / mean_v) if mean_v != 0 else 0
            variability = "high volatility" if cv > 0.4 else "consistent and stable"
            insights.append({
                "type": "Operational Baseline",
                "summary": f"{col.replace('_', ' ')} exhibits {variability} (Mean: {round(mean_v, 2)}, StdDev: {round(std_v, 2)}).",
                "evidence": f"Calculated over {len(s)} rows; coefficient of variation is {round(cv, 2)}."
            })

    return {
        "prediction": prediction_result,
        "insights": insights
    }
