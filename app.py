import os
import uuid
from datetime import datetime
from flask import Flask, render_template, jsonify, request, send_from_directory
import database

app = Flask(__name__, template_folder='templates', static_folder='static')

# Create necessary static folder structure if they don't exist
os.makedirs(os.path.join(app.root_path, 'templates'), exist_ok=True)
os.makedirs(os.path.join(app.root_path, 'static', 'css'), exist_ok=True)
os.makedirs(os.path.join(app.root_path, 'static', 'js'), exist_ok=True)

# ----------------- Main View -----------------
@app.route('/')
def index():
    return render_template('index.html')

# ----------------- Menu API -----------------
@app.route('/api/menu', methods=['GET', 'POST'])
def handle_menu():
    menu_items = database.get_menu()
    if request.method == 'GET':
        return jsonify(menu_items)
    
    if request.method == 'POST':
        data = request.json
        if not data or not data.get('name') or not data.get('price'):
            return jsonify({"error": "Name and Price are required"}), 400
        
        new_item = {
            "id": "m_" + str(uuid.uuid4())[:8],
            "name": data.get('name'),
            "category": data.get('category', 'Mains'),
            "price": float(data.get('price')),
            "description": data.get('description', ''),
            "image": data.get('image', 'default'),
            "available": data.get('available', True),
            "tags": data.get('tags', [])
        }
        menu_items.append(new_item)
        database.save_menu(menu_items)
        return jsonify(new_item), 201

@app.route('/api/menu/<item_id>', methods=['PUT', 'DELETE'])
def modify_menu(item_id):
    menu_items = database.get_menu()
    item_idx = next((i for i, item in enumerate(menu_items) if item["id"] == item_id), None)
    
    if item_idx is None:
        return jsonify({"error": "Item not found"}), 404
        
    if request.method == 'PUT':
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400
            
        menu_items[item_idx]["name"] = data.get('name', menu_items[item_idx]["name"])
        menu_items[item_idx]["category"] = data.get('category', menu_items[item_idx]["category"])
        menu_items[item_idx]["price"] = float(data.get('price', menu_items[item_idx]["price"]))
        menu_items[item_idx]["description"] = data.get('description', menu_items[item_idx]["description"])
        menu_items[item_idx]["available"] = data.get('available', menu_items[item_idx]["available"])
        menu_items[item_idx]["tags"] = data.get('tags', menu_items[item_idx]["tags"])
        
        database.save_menu(menu_items)
        return jsonify(menu_items[item_idx])
        
    if request.method == 'DELETE':
        removed = menu_items.pop(item_idx)
        database.save_menu(menu_items)
        return jsonify({"success": True, "removed": removed})

# ----------------- Tables API -----------------
@app.route('/api/tables', methods=['GET'])
def get_tables():
    return jsonify(database.get_tables())

@app.route('/api/tables/<int:table_id>', methods=['PUT'])
def update_table(table_id):
    tables = database.get_tables()
    table = next((t for t in tables if t["id"] == table_id), None)
    if not table:
        return jsonify({"error": "Table not found"}), 404
        
    data = request.json
    if not data:
        return jsonify({"error": "No data provided"}), 400
        
    table["status"] = data.get("status", table["status"])
    database.save_tables(tables)
    return jsonify(table)

# ----------------- Orders API -----------------
@app.route('/api/orders', methods=['GET', 'POST'])
def handle_orders():
    orders = database.get_orders()
    if request.method == 'GET':
        return jsonify(orders)
        
    if request.method == 'POST':
        data = request.json
        if not data or not data.get('table_id') or not data.get('items'):
            return jsonify({"error": "Table ID and order items are required"}), 400
            
        # Validate order items
        order_items = []
        subtotal = 0.0
        for item in data.get('items'):
            subtotal += float(item['price']) * int(item['quantity'])
            order_items.append({
                "id": item['id'],
                "name": item['name'],
                "price": float(item['price']),
                "quantity": int(item['quantity']),
                "notes": item.get('notes', '')
            })
            
        tax_rate = 0.09 # 9% luxury service tax
        tax = round(subtotal * tax_rate, 2)
        discount = float(data.get('discount', 0.0))
        total = round(subtotal + tax - discount, 2)
        
        table_id = int(data.get('table_id'))
        
        new_order = {
            "id": "ord_" + str(uuid.uuid4())[:8],
            "table_id": table_id,
            "items": order_items,
            "status": "Received",
            "subtotal": round(subtotal, 2),
            "tax": tax,
            "discount": discount,
            "total": total,
            "timestamp": datetime.now().isoformat()[:19],
            "is_paid": False
        }
        
        orders.append(new_order)
        database.save_orders(orders)
        
        # Update corresponding table status to Occupied
        tables = database.get_tables()
        table = next((t for t in tables if t["id"] == table_id), None)
        if table:
            table["status"] = "Occupied"
            database.save_tables(tables)
            
        return jsonify(new_order), 201

@app.route('/api/orders/<order_id>/status', methods=['PUT'])
def update_order_status(order_id):
    orders = database.get_orders()
    order = next((o for o in orders if o["id"] == order_id), None)
    if not order:
        return jsonify({"error": "Order not found"}), 404
        
    data = request.json
    if not data or 'status' not in data:
        return jsonify({"error": "Status is required"}), 400
        
    order["status"] = data["status"]
    database.save_orders(orders)
    return jsonify(order)

@app.route('/api/orders/<order_id>/pay', methods=['POST'])
def pay_order(order_id):
    orders = database.get_orders()
    order = next((o for o in orders if o["id"] == order_id), None)
    if not order:
        return jsonify({"error": "Order not found"}), 404
        
    order["is_paid"] = True
    order["status"] = "Served" # Ensure status is closed
    database.save_orders(orders)
    
    # Release the table (mark as Available)
    tables = database.get_tables()
    table = next((t for t in tables if t["id"] == order["table_id"]), None)
    if table:
        table["status"] = "Available"
        database.save_tables(tables)
        
    return jsonify({"success": True, "order": order})

# ----------------- Reservations API -----------------
@app.route('/api/reservations', methods=['GET', 'POST'])
def handle_reservations():
    reservations = database.get_reservations()
    if request.method == 'GET':
        return jsonify(reservations)
        
    if request.method == 'POST':
        data = request.json
        if not data or not data.get('guest_name') or not data.get('table_id'):
            return jsonify({"error": "Guest name and Table ID are required"}), 400
            
        table_id = int(data.get('table_id'))
        
        new_res = {
            "id": "res_" + str(uuid.uuid4())[:8],
            "guest_name": data.get('guest_name'),
            "phone": data.get('phone', ''),
            "party_size": int(data.get('party_size', 2)),
            "table_id": table_id,
            "time": data.get('time', '19:00'),
            "date": data.get('date', datetime.now().isoformat()[:10]),
            "notes": data.get('notes', '')
        }
        
        reservations.append(new_res)
        database.save_reservations(reservations)
        
        # Update corresponding table status to Reserved
        tables = database.get_tables()
        table = next((t for t in tables if t["id"] == table_id), None)
        if table:
            table["status"] = "Reserved"
            database.save_tables(tables)
            
        return jsonify(new_res), 201

@app.route('/api/reservations/<res_id>', methods=['DELETE'])
def cancel_reservation(res_id):
    reservations = database.get_reservations()
    res_idx = next((i for i, res in enumerate(reservations) if res["id"] == res_id), None)
    if res_idx is None:
        return jsonify({"error": "Reservation not found"}), 404
        
    res = reservations.pop(res_idx)
    database.save_reservations(reservations)
    
    # Revert corresponding table status back to Available if no other reservation/occupation exists
    tables = database.get_tables()
    table = next((t for t in tables if t["id"] == res["table_id"]), None)
    if table and table["status"] == "Reserved":
        table["status"] = "Available"
        database.save_tables(tables)
        
    return jsonify({"success": True, "removed": res})

# ----------------- Staff API -----------------
@app.route('/api/staff', methods=['GET', 'POST'])
def handle_staff():
    staff_items = database.get_staff()
    if request.method == 'GET':
        return jsonify(staff_items)
    
    if request.method == 'POST':
        data = request.json
        if not data or not data.get('name') or not data.get('role'):
            return jsonify({"error": "Name and Role are required"}), 400
        
        new_staff = {
            "id": "st_" + str(uuid.uuid4())[:8],
            "name": data.get('name'),
            "role": data.get('role'),
            "status": data.get('status', 'Active'),
            "shift": data.get('shift', 'Day (09:00 - 18:00)')
        }
        staff_items.append(new_staff)
        database.save_staff(staff_items)
        return jsonify(new_staff), 201

@app.route('/api/staff/<staff_id>', methods=['PUT', 'DELETE'])
def modify_staff(staff_id):
    staff_items = database.get_staff()
    staff_idx = next((i for i, st in enumerate(staff_items) if st["id"] == staff_id), None)
    
    if staff_idx is None:
        return jsonify({"error": "Staff member not found"}), 404
        
    if request.method == 'PUT':
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400
            
        staff_items[staff_idx]["name"] = data.get('name', staff_items[staff_idx]["name"])
        staff_items[staff_idx]["role"] = data.get('role', staff_items[staff_idx]["role"])
        staff_items[staff_idx]["status"] = data.get('status', staff_items[staff_idx]["status"])
        staff_items[staff_idx]["shift"] = data.get('shift', staff_items[staff_idx]["shift"])
        
        database.save_staff(staff_items)
        return jsonify(staff_items[staff_idx])
        
    if request.method == 'DELETE':
        removed = staff_items.pop(staff_idx)
        database.save_staff(staff_items)
        return jsonify({"success": True, "removed": removed})

# ----------------- Analytics API -----------------
@app.route('/api/analytics', methods=['GET'])
def get_analytics():
    orders = database.get_orders()
    tables = database.get_tables()
    
    # Revenue calculations
    total_revenue = sum(o["total"] for o in orders if o["is_paid"])
    
    # Tables statistics
    total_tables = len(tables)
    occupied_tables = sum(1 for t in tables if t["status"] == "Occupied")
    reserved_tables = sum(1 for t in tables if t["status"] == "Reserved")
    occupancy_rate = round((occupied_tables / total_tables) * 100, 1) if total_tables > 0 else 0
    
    # Active orders
    active_orders_count = sum(1 for o in orders if o["status"] in ["Received", "Preparing", "Ready to Serve"])
    
    # Popular items analysis
    item_counts = {}
    for o in orders:
        for item in o["items"]:
            item_counts[item["name"]] = item_counts.get(item["name"], 0) + item["quantity"]
            
    sorted_items = sorted(item_counts.items(), key=lambda x: x[1], reverse=True)
    popular_items = [{"name": name, "sales": count} for name, count in sorted_items[:5]]
    
    # Sales timeline (last few orders)
    sales_timeline = []
    # Sort orders by timestamp
    sorted_orders = sorted(orders, key=lambda o: o.get("timestamp", ""), reverse=True)
    for o in sorted_orders[:6]:
        sales_timeline.append({
            "id": o["id"],
            "table": f"Table {o['table_id']}",
            "amount": o["total"],
            "time": o.get("timestamp", "").split("T")[-1][:5] if "T" in o.get("timestamp", "") else ""
        })
        
    return jsonify({
        "revenue": round(total_revenue, 2),
        "occupancy_rate": occupancy_rate,
        "occupied_count": occupied_tables,
        "reserved_count": reserved_tables,
        "active_orders_count": active_orders_count,
        "popular_items": popular_items,
        "sales_timeline": sales_timeline
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
