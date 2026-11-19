import pandas as pd
import numpy as np
import datetime
import os

os.makedirs('sample_data', exist_ok=True)
np.random.seed(42)

# 1. Manufacturing Assembly & Defect Dataset (500 rows)
n_mfg = 500
machines = ['CNC-01', 'CNC-02', 'RoboWeld-A', 'RoboWeld-B', 'Assembly-Line-1']
products = ['Component-Alpha', 'Component-Beta', 'Component-Gamma', 'Component-Delta']
dates = [datetime.date(2025, 1, 1) + datetime.timedelta(days=int(i//10)) for i in range(n_mfg)]

cycle_times = []
defects = []
temps = []
prod_names = []
mfg_machines = []
costs = []

for i in range(n_mfg):
    prod = np.random.choice(products)
    mach = np.random.choice(machines)
    prod_names.append(prod)
    mfg_machines.append(mach)
    
    # Normal cycle times around 45 min, Beta takes 60 min
    base_ct = 60.0 if prod == 'Component-Beta' else 42.0
    ct = np.random.normal(base_ct, 4.0)
    
    # Introduce anomalies (~5%)
    if i in [14, 88, 142, 230, 312, 450]:
        ct += np.random.uniform(35, 75) # abnormal cycle spike
    
    cycle_times.append(round(max(10.0, ct), 2))
    
    # Defect rate
    base_defect = 1.5
    if i in [25, 110, 305]:
        base_defect += 12.0 # high defect spike
    defects.append(round(max(0.0, np.random.normal(base_defect, 0.8)), 2))
    
    temps.append(round(np.random.normal(72.0, 3.5), 1))
    costs.append(round(np.random.normal(120.0, 15.0), 2))

df_mfg = pd.DataFrame({
    'Record_ID': [f"MFG-{1000+i}" for i in range(n_mfg)],
    'Date': [d.isoformat() for d in dates],
    'Machine_ID': mfg_machines,
    'Product_Name': prod_names,
    'Cycle_Time_Min': cycle_times,
    'Defect_Rate_Pct': defects,
    'Operating_Temp_C': temps,
    'Unit_Cost_USD': costs,
    'Shift': np.random.choice(['Morning', 'Evening', 'Night'], n_mfg)
})

# Missing values in a couple rows to test data cleaning
df_mfg.loc[12, 'Operating_Temp_C'] = None
df_mfg.loc[45, 'Unit_Cost_USD'] = None
df_mfg.to_csv('sample_data/manufacturing_operations.csv', index=False)
print("Generated sample_data/manufacturing_operations.csv")

# 2. Logistics & Delivery Performance with Multi-Sheets Excel
n_del = 400
suppliers = ['Apex Logistics', 'FastTrack Freight', 'Global Haulage', 'SwiftAir Express']
facilities = ['Warehouse North', 'Warehouse South', 'Central Hub', 'Coast Depot']
order_types = ['Standard', 'Standard', 'Standard', 'Custom', 'Urgent']

delivery_days = []
ship_dates = []
del_suppliers = []
del_facilities = []
del_types = []
shipping_costs = []

for i in range(n_del):
    st = np.random.choice(order_types)
    sup = np.random.choice(suppliers)
    fac = np.random.choice(facilities)
    del_types.append(st)
    del_suppliers.append(sup)
    del_facilities.append(fac)
    
    s_date = datetime.date(2025, 2, 1) + datetime.timedelta(days=int(i//8))
    ship_dates.append(s_date.isoformat())
    
    # Standard: expected ~4 days, Custom: expected ~18 days, Urgent: expected ~2 days
    if st == 'Standard':
        days = np.random.normal(4.2, 0.9)
    elif st == 'Custom':
        days = np.random.normal(18.0, 2.5)
    else:
        days = np.random.normal(1.8, 0.4)
        
    # Anomaly delays
    if i in [18, 55, 120, 215, 330]:
        days += 14.0 # delay anomaly
    
    delivery_days.append(round(max(1.0, days), 1))
    shipping_costs.append(round(np.random.normal(350, 45), 2))

df_delivery = pd.DataFrame({
    'Shipment_ID': [f"SHIP-{2000+i}" for i in range(n_del)],
    'Ship_Date': ship_dates,
    'Supplier': del_suppliers,
    'Destination_Facility': del_facilities,
    'Order_Type': del_types,
    'Actual_Delivery_Days': delivery_days,
    'Shipping_Cost_USD': shipping_costs,
    'On_Time_Status': ['Delayed' if d > (10 if t=='Custom' else 5) else 'On-Time' for d, t in zip(delivery_days, del_types)]
})

# Create Multi-sheet Excel
with pd.ExcelWriter('sample_data/supply_chain_multi_sheet.xlsx', engine='openpyxl') as writer:
    df_delivery.to_excel(writer, sheet_name='Shipments', index=False)
    
    # Sheet 2: Suppliers Directory
    df_sup = pd.DataFrame({
        'Supplier_Name': suppliers,
        'Rating': [4.8, 4.2, 3.9, 4.6],
        'Contact_Email': [f"ops@{s.lower().replace(' ', '')}.com" for s in suppliers],
        'Default_SLA_Days': [5, 4, 6, 2]
    })
    df_sup.to_excel(writer, sheet_name='Supplier_Directory', index=False)

print("Generated sample_data/supply_chain_multi_sheet.xlsx with 2 sheets")
