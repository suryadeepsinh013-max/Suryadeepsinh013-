import json
import os
import threading
from datetime import datetime

DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'db.json')
db_lock = threading.Lock()

DEFAULT_MENU = [
    {
        "id": "m1",
        "name": "Paneer Dwarkadhish Special",
        "category": "Mains",
        "price": 380.00,
        "description": "Rich, creamy cottage cheese cubes simmered in a golden cashew-onion gravy, finished with dry fruits and butter.",
        "image": "paneer_dwarkadhish",
        "available": True,
        "tags": ["Signature", "Premium", "Vegetarian"]
    },
    {
        "id": "m2",
        "name": "Kaju Cheese Masala",
        "category": "Mains",
        "price": 420.00,
        "description": "Whole roasted cashew nuts and grated processed cheese cooked in a spicy, rich tomato-onion masala, topped with butter.",
        "image": "kaju_cheese",
        "available": True,
        "tags": ["Chef's Special", "Vegetarian"]
    },
    {
        "id": "m3",
        "name": "Kathiyawadi Sev Tameta Nu Shaak",
        "category": "Mains",
        "price": 260.00,
        "description": "Traditional Gujarati dish of juicy sweet-sour tomatoes simmered with local Kathiyawadi spices and topped with crispy garlic sev.",
        "image": "sev_tameta",
        "available": True,
        "tags": ["Kathiyawadi Spec.", "Vegetarian"]
    },
    {
        "id": "m4",
        "name": "Surati Locho & Chutney",
        "category": "Appetizers",
        "price": 150.00,
        "description": "Steamed seasoned yellow gram flour cake, served hot with raw oil, sev, onions, and spicy green garlic chutney.",
        "image": "surati_locho",
        "available": True,
        "tags": ["Popular", "Gluten-Free", "Vegetarian"]
    },
    {
        "id": "m5",
        "name": "Dwarka Special Garlic Paneer Tikka",
        "category": "Appetizers",
        "price": 290.00,
        "description": "Cubes of paneer marinated in fresh garlic yogurt paste and roasted spices, char-grilled to perfection in a hot tandoor clay oven.",
        "image": "paneer_tikka",
        "available": True,
        "tags": ["Signature", "Vegetarian"]
    },
    {
        "id": "m6",
        "name": "Cheese Butter Masala Papad",
        "category": "Appetizers",
        "price": 110.00,
        "description": "Crispy roasted roasted urad papad topped with finely chopped tomatoes, onions, green chillies, coriander, and grated cheese.",
        "image": "masala_papad",
        "available": True,
        "tags": ["Crispy", "Vegetarian"]
    },
    {
        "id": "m7",
        "name": "Shahi Kesar Pista Basundi",
        "category": "Desserts",
        "price": 220.00,
        "description": "Rich thickened sweet condensed milk flavored with real saffron threads, cardamoms, and roasted sliced pistachios.",
        "image": "kesar_basundi",
        "available": True,
        "tags": ["Traditional", "Vegetarian"]
    },
    {
        "id": "m8",
        "name": "Dwarka Special sizzling Gulab Jamun",
        "category": "Desserts",
        "price": 180.00,
        "description": "Hot, juicy milk-solid dumplings steeped in rosewater-infused sugar syrup, served sizzling with vanilla gelato.",
        "image": "gulab_jamun",
        "available": True,
        "tags": ["Vegetarian"]
    },
    {
        "id": "m9",
        "name": "Special Masala Buttermilk (Chaas)",
        "category": "Drinks",
        "price": 80.00,
        "description": "Refreshing spiced thin yogurt drink churned with roasted cumin powder, fresh coriander leaves, ginger, and black salt.",
        "image": "masala_chaas",
        "available": True,
        "tags": ["Refreshing", "Vegetarian"]
    },
    {
        "id": "m10",
        "name": "Kesar Mango Lassi",
        "category": "Drinks",
        "price": 120.00,
        "description": "Thick, creamy churned sweet yogurt blended with premium kesar mango pulp and garnished with saffron threads.",
        "image": "mango_lassi",
        "available": True,
        "tags": ["Signature", "Vegetarian"]
    }
]

DEFAULT_TABLES = [
    {"id": 1, "number": "Table 1", "capacity": 2, "status": "Available", "section": "Main Hall"},
    {"id": 2, "number": "Table 2", "capacity": 2, "status": "Available", "section": "Main Hall"},
    {"id": 3, "number": "Table 3", "capacity": 4, "status": "Available", "section": "Main Hall"},
    {"id": 4, "number": "Table 4", "capacity": 4, "status": "Available", "section": "Main Hall"},
    {"id": 5, "number": "Table 5", "capacity": 6, "status": "Available", "section": "Main Hall"},
    {"id": 6, "number": "Table 6", "capacity": 8, "status": "Available", "section": "VIP Lounge"},
    {"id": 7, "number": "Table 7", "capacity": 4, "status": "Available", "section": "VIP Lounge"},
    {"id": 8, "number": "Table 8", "capacity": 2, "status": "Available", "section": "Terrace"},
    {"id": 9, "number": "Table 9", "capacity": 2, "status": "Available", "section": "Terrace"},
    {"id": 10, "number": "Table 10", "capacity": 4, "status": "Available", "section": "Terrace"},
    {"id": 11, "number": "Bar Seats A", "capacity": 1, "status": "Available", "section": "Bar"},
    {"id": 12, "number": "Bar Seats B", "capacity": 1, "status": "Available", "section": "Bar"}
]

# Seed order history to make charts and analytics look populated and professional right from the start!
DEFAULT_ORDERS = [
    {
        "id": "ord_1001",
        "table_id": 3,
        "items": [
            {"id": "m1", "name": "Paneer Dwarkadhish Special", "price": 380.00, "quantity": 2, "notes": "No extra butter"},
            {"id": "m9", "name": "Special Masala Buttermilk (Chaas)", "price": 80.00, "quantity": 2, "notes": ""}
        ],
        "status": "Served",
        "subtotal": 920.00,
        "tax": 82.80,
        "discount": 0.00,
        "total": 1002.80,
        "timestamp": "2026-05-28T11:20:00",
        "is_paid": True
    },
    {
        "id": "ord_1002",
        "table_id": 5,
        "items": [
            {"id": "m2", "name": "Kaju Cheese Masala", "price": 420.00, "quantity": 1, "notes": "Medium spice"},
            {"id": "m4", "name": "Surati Locho & Chutney", "price": 150.00, "quantity": 1, "notes": ""},
            {"id": "m10", "name": "Kesar Mango Lassi", "price": 120.00, "quantity": 2, "notes": ""}
        ],
        "status": "Served",
        "subtotal": 810.00,
        "tax": 72.90,
        "discount": 100.00,
        "total": 782.90,
        "timestamp": "2026-05-28T12:05:00",
        "is_paid": True
    },
    {
        "id": "ord_1003",
        "table_id": 6,
        "items": [
            {"id": "m2", "name": "Kaju Cheese Masala", "price": 420.00, "quantity": 3, "notes": "Less spicy"},
            {"id": "m3", "name": "Kathiyawadi Sev Tameta Nu Shaak", "price": 260.00, "quantity": 1, "notes": ""},
            {"id": "m5", "name": "Dwarka Special Garlic Paneer Tikka", "price": 290.00, "quantity": 2, "notes": ""},
            {"id": "m8", "name": "Dwarka Special sizzling Gulab Jamun", "price": 180.00, "quantity": 4, "notes": ""}
        ],
        "status": "Preparing",
        "subtotal": 2820.00,
        "tax": 253.80,
        "discount": 0.00,
        "total": 3073.80,
        "timestamp": datetime.now().isoformat()[:19],
        "is_paid": False
    }
]

DEFAULT_RESERVATIONS = [
    {
        "id": "res_2001",
        "guest_name": "Alexander Sterling",
        "phone": "+1 (555) 019-2834",
        "party_size": 4,
        "table_id": 6,
        "time": "20:30",
        "date": "2026-05-28",
        "notes": "VIP anniversary celebration. Prefers quiet corner."
    },
    {
        "id": "res_2002",
        "guest_name": "Sophia Moretti",
        "phone": "+1 (555) 014-9844",
        "party_size": 2,
        "table_id": 1,
        "time": "19:00",
        "date": "2026-05-28",
        "notes": "Gluten allergy."
    }
]

DEFAULT_STAFF = [
    {"id": "st1", "name": "admin", "role": "General Manager", "status": "Active", "shift": "Day (09:00 - 18:00)"},
    {"id": "st2", "name": "Rajesh Patel", "role": "Server", "status": "Active", "shift": "Evening (16:00 - 23:00)"},
    {"id": "st3", "name": "Amit Sharma", "role": "Chef", "status": "Active", "shift": "Day (09:00 - 18:00)"},
    {"id": "st4", "name": "Pooja Mehta", "role": "Server", "status": "On Break", "shift": "Evening (16:00 - 23:00)"}
]

def load_db():
    with db_lock:
        if not os.path.exists(DB_FILE):
            data = {
                "menu": DEFAULT_MENU,
                "tables": DEFAULT_TABLES,
                "orders": DEFAULT_ORDERS,
                "reservations": DEFAULT_RESERVATIONS,
                "staff": DEFAULT_STAFF
            }
            save_db_internal(data)
            return data
        try:
            with open(DB_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                # Check for backward compatibility
                if "staff" not in data:
                    data["staff"] = DEFAULT_STAFF
                    save_db_internal(data)
                return data
        except Exception:
            # In case of corruption, re-seed
            data = {
                "menu": DEFAULT_MENU,
                "tables": DEFAULT_TABLES,
                "orders": DEFAULT_ORDERS,
                "reservations": DEFAULT_RESERVATIONS,
                "staff": DEFAULT_STAFF
            }
            save_db_internal(data)
            return data

def save_db_internal(data):
    try:
        with open(DB_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4)
    except Exception as e:
        print(f"Error saving DB: {e}")

def save_db(data):
    with db_lock:
        save_db_internal(data)

# Helper wrappers for clean modules
def get_menu():
    return load_db()["menu"]

def save_menu(menu_list):
    db = load_db()
    db["menu"] = menu_list
    save_db(db)

def get_tables():
    return load_db()["tables"]

def save_tables(tables_list):
    db = load_db()
    db["tables"] = tables_list
    save_db(db)

def get_orders():
    return load_db()["orders"]

def save_orders(orders_list):
    db = load_db()
    db["orders"] = orders_list
    save_db(db)

def get_reservations():
    return load_db()["reservations"]

def save_reservations(reservations_list):
    db = load_db()
    db["reservations"] = reservations_list
    save_db(db)

def get_staff():
    return load_db()["staff"]

def save_staff(staff_list):
    db = load_db()
    db["staff"] = staff_list
    save_db(db)
