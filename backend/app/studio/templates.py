import pandas as pd
from typing import Dict, Any, List

def get_builtin_templates() -> List[Dict[str, Any]]:
    """Returns curated ready-to-launch business application templates."""
    return [
        {
            "id": "tpl_hr_directory",
            "name": "Employee & Workforce Directory",
            "domain": "Human Resources & Workforce",
            "description": "Complete personnel registry with departments, salary bands, hire dates, performance scores, and contact information.",
            "icon": "Users",
            "sheets_count": 1,
            "entities": ["Employee"],
            "sample_records_count": 25,
            "features": ["Staff Profiles", "Department Analytics", "Salary Bands", "Contact Directory"]
        },
        {
            "id": "tpl_supply_chain",
            "name": "Supply Chain & Multi-Vendor Hub",
            "domain": "Supply Chain & Multi-Vendor Logistics",
            "description": "Cross-relational logistics tracker linking carrier shipments with verified supplier ratings and delivery SLA metrics.",
            "icon": "Truck",
            "sheets_count": 2,
            "entities": ["Shipment", "Supplier"],
            "sample_records_count": 404,
            "features": ["Multi-Entity Linking", "Carrier Performance", "SLA Adherence", "Cost Tracking"]
        },
        {
            "id": "tpl_mfg_assembly",
            "name": "Manufacturing Quality & Shift Hub",
            "domain": "Manufacturing & Industrial Quality",
            "description": "Production operations portal monitoring machine telemetry, cycle times, defect rates, and shift outputs.",
            "icon": "Cpu",
            "sheets_count": 1,
            "entities": ["Manufacturing Operation"],
            "sample_records_count": 500,
            "features": ["Defect Tracking", "Machine Telemetry", "Cycle Times", "Shift Audits"]
        },
        {
            "id": "tpl_inventory_hub",
            "name": "Inventory & Warehouse SKU Portal",
            "domain": "Inventory & Warehouse Operations",
            "description": "Real-time stock management, warehouse bin locations, reorder thresholds, and unit valuation.",
            "icon": "Package",
            "sheets_count": 1,
            "entities": ["Inventory Item"],
            "sample_records_count": 30,
            "features": ["Stock Status", "Bin Locations", "Reorder Alerts", "Asset Valuation"]
        }
    ]

def get_template_data(template_id: str) -> Dict[str, pd.DataFrame]:
    """Generates realistic in-memory DataFrames for instant template instantiation."""
    if template_id == "tpl_hr_directory":
        employees = [
            {"Employee_ID": "EMP-101", "Full_Name": "Elena Rostova", "Department": "Engineering", "Job_Title": "Lead Architect", "Email": "elena.r@company.io", "Salary_USD": 145000, "Hire_Date": "2021-03-15", "Status": "Active"},
            {"Employee_ID": "EMP-102", "Full_Name": "Marcus Vance", "Department": "Product", "Job_Title": "Senior PM", "Email": "marcus.v@company.io", "Salary_USD": 128000, "Hire_Date": "2022-01-10", "Status": "Active"},
            {"Employee_ID": "EMP-103", "Full_Name": "Aisha Patel", "Department": "Sales", "Job_Title": "Enterprise AE", "Email": "aisha.p@company.io", "Salary_USD": 115000, "Hire_Date": "2020-07-01", "Status": "Active"},
            {"Employee_ID": "EMP-104", "Full_Name": "Devon Miller", "Department": "Marketing", "Job_Title": "Growth Lead", "Email": "devon.m@company.io", "Salary_USD": 95000, "Hire_Date": "2023-04-18", "Status": "Active"},
            {"Employee_ID": "EMP-105", "Full_Name": "Sofia Chen", "Department": "Engineering", "Job_Title": "DevOps Engineer", "Email": "sofia.c@company.io", "Salary_USD": 132000, "Hire_Date": "2022-09-01", "Status": "Active"},
            {"Employee_ID": "EMP-106", "Full_Name": "Liam O'Connor", "Department": "Finance", "Job_Title": "Financial Analyst", "Email": "liam.o@company.io", "Salary_USD": 88000, "Hire_Date": "2023-02-14", "Status": "Active"},
            {"Employee_ID": "EMP-107", "Full_Name": "Zara Al-Mansoor", "Department": "Human Resources", "Job_Title": "Talent Partner", "Email": "zara.a@company.io", "Salary_USD": 82000, "Hire_Date": "2021-11-20", "Status": "Active"},
            {"Employee_ID": "EMP-108", "Full_Name": "Lucas Silva", "Department": "Customer Success", "Job_Title": "CSM Director", "Email": "lucas.s@company.io", "Salary_USD": 110000, "Hire_Date": "2019-05-12", "Status": "Active"},
            {"Employee_ID": "EMP-109", "Full_Name": "Hannah Abbott", "Department": "Engineering", "Job_Title": "Frontend Specialist", "Email": "hannah.a@company.io", "Salary_USD": 120000, "Hire_Date": "2022-06-30", "Status": "On Leave"},
            {"Employee_ID": "EMP-110", "Full_Name": "Carlos Mendoza", "Department": "Operations", "Job_Title": "Ops Coordinator", "Email": "carlos.m@company.io", "Salary_USD": 76000, "Hire_Date": "2023-08-05", "Status": "Active"}
        ]
        return {"Employees": pd.DataFrame(employees)}

    elif template_id == "tpl_inventory_hub":
        items = [
            {"SKU": "SKU-901", "Item_Name": "Industrial Power Inverter 5kW", "Category": "Electronics", "Warehouse_Zone": "Zone A-North", "Stock_Qty": 45, "Reorder_Level": 15, "Unit_Cost_USD": 380.00, "Status": "In Stock"},
            {"SKU": "SKU-902", "Item_Name": "Heavy Duty Copper Busbar 100A", "Category": "Hardware", "Warehouse_Zone": "Zone B-West", "Stock_Qty": 12, "Reorder_Level": 20, "Unit_Cost_USD": 65.50, "Status": "Low Stock"},
            {"SKU": "SKU-903", "Item_Name": "Brushless DC Motor 24V", "Category": "Motors", "Warehouse_Zone": "Zone C-East", "Stock_Qty": 88, "Reorder_Level": 25, "Unit_Cost_USD": 112.00, "Status": "In Stock"},
            {"SKU": "SKU-904", "Item_Name": "Solid State Relay 40A", "Category": "Electronics", "Warehouse_Zone": "Zone A-North", "Stock_Qty": 140, "Reorder_Level": 50, "Unit_Cost_USD": 24.80, "Status": "In Stock"},
            {"SKU": "SKU-905", "Item_Name": "Thermal Overload Relay", "Category": "Hardware", "Warehouse_Zone": "Zone B-West", "Stock_Qty": 5, "Reorder_Level": 10, "Unit_Cost_USD": 45.00, "Status": "Critical"},
            {"SKU": "SKU-906", "Item_Name": "Digital Power Meter Modbus", "Category": "Instruments", "Warehouse_Zone": "Zone D-Vault", "Stock_Qty": 60, "Reorder_Level": 15, "Unit_Cost_USD": 195.00, "Status": "In Stock"},
            {"SKU": "SKU-907", "Item_Name": "Fiber Optic Transceiver 10G", "Category": "Electronics", "Warehouse_Zone": "Zone D-Vault", "Stock_Qty": 0, "Reorder_Level": 10, "Unit_Cost_USD": 85.00, "Status": "Out of Stock"}
        ]
        return {"Inventory": pd.DataFrame(items)}

    elif template_id == "tpl_supply_chain":
        import os
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
        if not os.path.exists(os.path.join(base_dir, "sample_data")):
            base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        path = os.path.join(base_dir, "sample_data", "supply_chain_multi_sheet.xlsx")
        xl = pd.ExcelFile(path)
        return {s: xl.parse(s) for s in xl.sheet_names}

    elif template_id == "tpl_mfg_assembly":
        import os
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
        if not os.path.exists(os.path.join(base_dir, "sample_data")):
            base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        path = os.path.join(base_dir, "sample_data", "manufacturing_operations.csv")
        return {"Manufacturing": pd.read_csv(path)}

    else:
        raise ValueError(f"Unknown template ID: {template_id}")
