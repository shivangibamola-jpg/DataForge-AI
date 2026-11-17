import re
import difflib
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional, Tuple
from app.engine.data_store import store

# Number words mapping for natural language parsing
NUMBER_WORDS = {
    'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
    'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
    'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70,
    'eighty': 80, 'ninety': 90, 'hundred': 100, 'thousand': 1000, 'million': 1000000
}

def parse_spoken_number(text: str) -> Optional[float]:
    """Parse text that may contain digits or spoken number words e.g. 'five', '20000', '20k'."""
    text = text.strip().lower()
    if not text:
        return None
    # Check simple digits
    if re.match(r'^-?\d+(\.\d+)?$', text):
        return float(text)
    # Check 20k / 2m
    m = re.match(r'^(-?\d+(\.\d+)?)\s*k$', text)
    if m:
        return float(m.group(1)) * 1000
    m = re.match(r'^(-?\d+(\.\d+)?)\s*m$', text)
    if m:
        return float(m.group(1)) * 1000000

    # Spoken number words
    words = re.findall(r'\b[a-z]+\b', text)
    total = 0
    current = 0
    found_any = False
    for w in words:
        if w in NUMBER_WORDS:
            found_any = True
            val = NUMBER_WORDS[w]
            if val in (100, 1000, 1000000):
                current = max(1, current) * val
                total += current
                current = 0
            else:
                current += val
    total += current
    return float(total) if found_any else None


def extract_search_tokens(query: str) -> List[str]:
    """Cleans and tokenizes search query."""
    return [t for t in re.split(r'[\s,]+', query.strip()) if t]


def find_similar_words(target: str, vocab: List[str], cutoff=0.75, n=3) -> List[str]:
    """Uses difflib to find spelling suggestions."""
    if not target or len(target) < 3:
        return []
    matches = difflib.get_close_matches(target, vocab, n=n, cutoff=cutoff)
    return [m for m in matches if m.lower() != target.lower()]


def compute_column_stats(series: pd.Series) -> Dict[str, Any]:
    """Quick descriptive stats for a column."""
    res: Dict[str, Any] = {
        "count": int(series.count()),
        "missing": int(series.isna().sum()),
        "unique": int(series.nunique())
    }
    numeric_s = pd.to_numeric(series.dropna(), errors='coerce').dropna()
    if len(numeric_s) > 0 and len(numeric_s) >= len(series.dropna()) * 0.7:
        res["type"] = "numeric"
        res["min"] = float(numeric_s.min())
        res["max"] = float(numeric_s.max())
        res["mean"] = round(float(numeric_s.mean()), 2)
        res["median"] = round(float(numeric_s.median()), 2)
        res["std"] = round(float(numeric_s.std()), 2) if len(numeric_s) > 1 else 0.0
        # Distribution histogram buckets
        try:
            counts, bin_edges = np.histogram(numeric_s, bins=min(10, max(3, len(numeric_s) // 10)))
            res["histogram"] = [
                {"bin": f"{round(bin_edges[i], 1)}-{round(bin_edges[i+1], 1)}", "count": int(counts[i])}
                for i in range(len(counts))
            ]
        except Exception:
            res["histogram"] = []
    else:
        res["type"] = "text"
        top_counts = series.value_counts().head(8).to_dict()
        res["top_values"] = {str(k): int(v) for k, v in top_counts.items()}
    return res


def build_sheet_vocabulary(df: pd.DataFrame) -> List[str]:
    """Builds a unique token vocabulary for spelling recommendations."""
    vocab = set()
    for col in df.columns:
        vocab.add(str(col))
        for part in re.split(r'[_\s]+', str(col)):
            if len(part) >= 3:
                vocab.add(part)
        s_vals = df[col].dropna().astype(str).unique()
        for v in s_vals[:200]:
            if len(v) < 30:
                vocab.add(v)
                for part in re.split(r'[_\s\-/]+', v):
                    if len(part) >= 3:
                        vocab.add(part)
    return list(vocab)


def match_column_fuzzy_or_tokens(query_str: str, columns: List[str]) -> Optional[str]:
    """Matches a column name by token containment, underscore variations, or substring."""
    norm_query = re.sub(r'[^a-z0-9]', '', query_str.lower())
    for col in columns:
        norm_col = re.sub(r'[^a-z0-9]', '', col.lower())
        if norm_col in norm_query or norm_query in norm_col:
            return col
    # Split query into words
    words = [w for w in re.split(r'[^a-z0-9]', query_str.lower()) if len(w) > 2]
    best_col = None
    best_score = 0
    for col in columns:
        col_parts = set(re.split(r'[^a-z0-9]', col.lower()))
        score = sum(1 for w in words if any(w in cp or cp in w for cp in col_parts))
        if score > best_score:
            best_score = score
            best_col = col
    return best_col if best_score > 0 else None


def parse_natural_language_intent(query: str, df: pd.DataFrame) -> Optional[Dict[str, Any]]:
    """
    Parses intent from phrases like:
    - 'Find all Samsung products'
    - 'Find Samsung products costing more than 20000'
    - 'Show deliveries delayed by more than five days'
    - 'Defects greater than 5'
    - 'Orders with status Pending'
    - 'Summary of cycle time' / 'Stats for defect rate'
    """
    clean_q = query.strip()
    lower_q = clean_q.lower()
    cols = list(df.columns)

    # Intent 1: Statistical inspection
    summary_match = re.search(r'\b(?:summary|stats|statistics|distribution|average|mean|describe)\b(?:\s+(?:of|for|on))?\s*(.*)', lower_q)
    if summary_match:
        target_name = summary_match.group(1).strip()
        matched_col = match_column_fuzzy_or_tokens(target_name, cols)
        if matched_col:
            stats = compute_column_stats(df[matched_col])
            return {
                "type": "statistical_summary",
                "column": matched_col,
                "summary": stats,
                "explanation": f"Statistical summary for '{matched_col}'"
            }

    # Intent 2: Numeric Comparison
    comp_pattern = r'(?P<field>[a-zA-Z0-9_\s]+?)\s+(?P<op>more than|greater than|above|exceeding|over|>|less than|under|below|fewer than|<|equals? to|equals?|==?)\s+(?P<val>[a-zA-Z0-9_.]+(?:\s+[a-zA-Z]+)?)'
    for m in re.finditer(comp_pattern, lower_q):
        raw_field = m.group('field').strip()
        raw_op = m.group('op').strip()
        raw_val = m.group('val').strip()

        num_val = parse_spoken_number(raw_val)
        if num_val is None:
            val_num_match = re.search(r'(\d+(\.\d+)?)', raw_val)
            if val_num_match:
                num_val = float(val_num_match.group(1))

        if num_val is not None:
            op_sym = ">"
            if any(w in raw_op for w in ['less', 'under', 'below', 'fewer', '<']):
                op_sym = "<"
            elif any(w in raw_op for w in ['equal', '==', '=']):
                op_sym = "=="

            target_col = match_column_fuzzy_or_tokens(raw_field, cols)
            if not target_col:
                target_col = match_column_fuzzy_or_tokens(lower_q, cols)

            if target_col:
                entity_filter = None
                pre_text = lower_q[:m.start()].strip()
                cleaned_pre = re.sub(r'^(find|show|filter|get|search|list)\s+(all\s+)?', '', pre_text).strip()
                cleaned_pre = re.sub(r'\b(products|items|orders|records|units|data)\b', '', cleaned_pre).strip()
                if cleaned_pre and len(cleaned_pre) > 1:
                    entity_filter = cleaned_pre

                return {
                    "type": "numeric_filter",
                    "column": target_col,
                    "operator": op_sym,
                    "value": num_val,
                    "entity_filter": entity_filter,
                    "explanation": f"Filtered '{target_col}' {op_sym} {num_val}" + (f" matching '{entity_filter}'" if entity_filter else "")
                }

    # Intent 3: Categorical / Entity filter "Find all [X] products/items/records"
    cat_match = re.search(r'^(?:find|show|filter|get|search|list)\s+(?:all\s+)?([a-zA-Z0-9_\-\.\s]+?)(?:\s+(?:products|items|orders|records|shipments|rows|data))?$', lower_q)
    if cat_match:
        keyword = cat_match.group(1).strip()
        if keyword and keyword not in ('all', 'records', 'items', 'rows'):
            return {
                "type": "keyword_filter",
                "keyword": keyword,
                "explanation": f"Searching for records matching '{keyword}'"
            }

    return None


def execute_universal_search(
    dataset_id: str,
    query: str,
    selected_sheet: Optional[str] = None,
    selected_column: Optional[str] = None,
    fuzzy: bool = True,
    fuzzy_threshold: float = 0.75,
    page: int = 1,
    page_size: int = 25,
    sort_by: Optional[str] = None,
    sort_asc: bool = True
) -> Dict[str, Any]:
    """
    Core universal search across sheets & columns with NL understanding,
    fuzzy matching, spelling suggestions, and rich highlighting.
    """
    clean_q = query.strip()
    available_sheets = store.worksheets.get(dataset_id, ["Default"])
    sheets_to_search = [selected_sheet] if selected_sheet and selected_sheet != "all" else available_sheets

    all_results = []
    suggestions_set = set()
    nl_applied = None
    stats_view = None
    stats_col = None

    for s_name in sheets_to_search:
        key = f"{dataset_id}_{s_name}"
        if key not in store.raw_dataframes:
            if dataset_id in store.raw_dataframes and (s_name == "Default" or len(available_sheets) == 1):
                df = store.active_dataframes[dataset_id]
            else:
                continue
        else:
            df = store.active_dataframes.get(key, store.raw_dataframes[key])

        # Generate spelling recommendations using vocabulary
        vocab = build_sheet_vocabulary(df)
        tokens = extract_search_tokens(clean_q)
        for token in tokens:
            sims = find_similar_words(token, vocab, cutoff=fuzzy_threshold)
            for s in sims:
                suggestions_set.add(s)

        # 1. Check for Natural Language structured intent
        nl_intent = parse_natural_language_intent(clean_q, df)
        
        filtered_df = df.copy()
        matched_col_map = {}

        if nl_intent:
            nl_applied = nl_intent
            if nl_intent["type"] == "numeric_filter":
                col = nl_intent["column"]
                op = nl_intent["operator"]
                val = nl_intent["value"]
                num_s = pd.to_numeric(df[col], errors='coerce')
                if op == ">":
                    mask = num_s > val
                elif op == "<":
                    mask = num_s < val
                else:
                    mask = (num_s == val)
                
                if nl_intent.get("entity_filter"):
                    ent = nl_intent["entity_filter"].lower()
                    ent_mask = pd.Series(False, index=df.index)
                    for c in df.columns:
                        ent_mask = ent_mask | df[c].astype(str).str.lower().str.contains(ent, regex=False, na=False)
                    mask = mask & ent_mask

                filtered_df = df[mask].copy()
                for idx in filtered_df.index:
                    matched_col_map[idx] = [col]

            elif nl_intent["type"] == "keyword_filter":
                kw = nl_intent["keyword"].lower()
                mask = pd.Series(False, index=df.index)
                for c in df.columns:
                    col_has = df[c].astype(str).str.lower().str.contains(kw, regex=False, na=False)
                    for idx in df[col_has].index:
                        matched_col_map.setdefault(idx, []).append(c)
                    mask = mask | col_has
                filtered_df = df[mask].copy()

            elif nl_intent["type"] == "statistical_summary":
                stats_view = nl_intent["summary"]
                stats_col = nl_intent["column"]
                filtered_df = df.copy()
                for idx in filtered_df.index:
                    matched_col_map[idx] = [stats_col]
        else:
            # Standard exact + partial + fuzzy search
            cols_to_check = [selected_column] if selected_column and selected_column != "all" and selected_column in df.columns else list(df.columns)
            
            mask = pd.Series(False, index=df.index)
            lower_tokens = [t.lower() for t in tokens]

            for c in cols_to_check:
                s_str = df[c].fillna('').astype(str)
                s_lower = s_str.str.lower()
                
                col_match = pd.Series(True, index=df.index) if lower_tokens else pd.Series(False, index=df.index)
                for t in lower_tokens:
                    col_match = col_match & s_lower.str.contains(t, regex=False)

                # Fuzzy fallback if exact token misses
                if fuzzy and not col_match.any() and lower_tokens:
                    unique_vals = s_lower.unique()
                    fuzzy_matched_vals = set()
                    for t in lower_tokens:
                        matches = difflib.get_close_matches(t, unique_vals, n=5, cutoff=fuzzy_threshold)
                        fuzzy_matched_vals.update(matches)
                    if fuzzy_matched_vals:
                        col_match = s_lower.isin(fuzzy_matched_vals)

                for idx in df[col_match].index:
                    matched_col_map.setdefault(idx, []).append(c)

                mask = mask | col_match

            filtered_df = df[mask].copy()

        # Add sheet context and row context
        filtered_df["__sheet__"] = s_name
        filtered_df["__row_idx__"] = filtered_df.index
        filtered_df["__matched_cols__"] = [matched_col_map.get(i, []) for i in filtered_df.index]

        all_results.append(filtered_df)

    if not all_results:
        combined_df = pd.DataFrame()
    else:
        combined_df = pd.concat(all_results, ignore_index=True)

    total_matches = len(combined_df)

    # Sorting
    if sort_by and sort_by in combined_df.columns:
        combined_df = combined_df.sort_values(by=sort_by, ascending=sort_asc)

    # Pagination
    total_pages = max(1, (total_matches + page_size - 1) // page_size)
    start_idx = (page - 1) * page_size
    end_idx = min(start_idx + page_size, total_matches)

    paginated_slice = combined_df.iloc[start_idx:end_idx].copy()
    records = paginated_slice.replace({np.nan: None, np.inf: None, -np.inf: None}).to_dict(orient="records")
    columns = [c for c in combined_df.columns if not c.startswith("__")]

    return {
        "query": query,
        "is_nl": nl_applied is not None,
        "nl_intent": nl_applied,
        "total_matches": total_matches,
        "sheets_searched": sheets_to_search,
        "suggestions": [s for s in list(suggestions_set)[:5] if s.lower() not in clean_q.lower()],
        "records": records,
        "columns": columns,
        "stats_view": stats_view,
        "stats_column": stats_col,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }
