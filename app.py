from uuid import uuid4

from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

MENU = [
    {
        "id": "benne-masala-dosa",
        "name": "Bengaluru benne masala dosa",
        "description": "Golden dosa, potato palya, a generous swipe of benne, chutney.",
        "price": 149,
        "category": "Breakfast",
        "rating": 4.9,
        "time": "20–25 min",
        "badge": "Local favorite",
        "image": "photo-1630383249896-424e482df921",
    },
    {
        "id": "thatte-idli",
        "name": "Thatte idli & sambar",
        "description": "Soft rice cakes, coconut chutney, homestyle sambar, podi.",
        "price": 119,
        "category": "Breakfast",
        "rating": 4.8,
        "time": "15–20 min",
        "badge": "Vegetarian",
        "image": "photo-1601050690597-df0568f70950",
    },
    {
        "id": "donne-chicken-biryani",
        "name": "Donne-style chicken biryani",
        "description": "Peppery jeera rice, tender chicken, onion raita, lemon.",
        "price": 249,
        "category": "Biryani",
        "rating": 4.9,
        "time": "25–35 min",
        "badge": "Bestseller",
        "image": "photo-1589302168068-964664d93dc0",
    },
    {
        "id": "paneer-tikka-bowl",
        "name": "Paneer tikka rice bowl",
        "description": "Tandoori paneer, jeera rice, kachumber, mint yogurt.",
        "price": 219,
        "category": "Bowls",
        "rating": 4.7,
        "time": "20–30 min",
        "badge": "Vegetarian",
        "image": "photo-1603894584373-5ac82b2ae398",
    },
    {
        "id": "mangalorean-fish-meal",
        "name": "Mangalorean fish curry meal",
        "description": "Tangy coastal curry, steamed rice, seasonal vegetable poriyal.",
        "price": 289,
        "category": "Meals",
        "rating": 4.8,
        "time": "25–35 min",
        "badge": "Coastal style",
        "image": "photo-1606491956689-2ea866880c84",
    },
    {
        "id": "filter-coffee-brownie",
        "name": "Filter coffee brownie",
        "description": "Fudgy dark chocolate, a hit of Mysore filter coffee.",
        "price": 99,
        "category": "Desserts",
        "rating": 4.9,
        "time": "10–15 min",
        "badge": "House made",
        "image": "photo-1606313564200-e75d5e30476c",
    },
]

MENU_BY_ID = {item["id"]: item for item in MENU}
DELIVERY_FEE = 29
FREE_DELIVERY_THRESHOLD = 499
PACKAGING_FEE = 8
GST_RATE = 0.05
PROMO_CODE = "FIRSTBITE"


@app.get("/")
def home():
    return render_template("index.html")


@app.get("/api/menu")
def get_menu():
    return jsonify(MENU)


@app.post("/api/orders")
def create_order():
    payload = request.get_json(silent=True) or {}
    name = str(payload.get("name", "")).strip()
    address = str(payload.get("address", "")).strip()
    phone = "".join(character for character in str(payload.get("phone", "")) if character.isdigit())
    pincode = str(payload.get("pincode", "")).strip()
    items = payload.get("items", [])
    fulfillment = payload.get("fulfillment", "delivery")
    promo_code = str(payload.get("promo_code", "")).strip().upper()

    if not name:
        return jsonify(error="Add your name to continue."), 400
    if fulfillment == "delivery" and not address:
        return jsonify(error="Add your delivery address to continue."), 400
    if len(phone) != 10 or phone[0] not in "6789":
        return jsonify(error="Enter a valid 10-digit Indian mobile number."), 400
    if fulfillment == "delivery" and (len(pincode) != 6 or not pincode.startswith("560")):
        return jsonify(error="Enter a Bengaluru PIN code starting with 560."), 400
    if not isinstance(items, list) or not items:
        return jsonify(error="Your bag is empty."), 400
    if fulfillment not in {"delivery", "pickup"}:
        return jsonify(error="Choose delivery or pickup."), 400
    if promo_code and promo_code != PROMO_CODE:
        return jsonify(error="That welcome code is not valid."), 400

    order_lines = []
    subtotal = 0
    for line in items:
        if not isinstance(line, dict):
            return jsonify(error="One of the items in your bag is invalid."), 400
        item = MENU_BY_ID.get(line.get("id"))
        quantity = line.get("quantity")
        if item is None or isinstance(quantity, bool) or not isinstance(quantity, int) or not 1 <= quantity <= 25:
            return jsonify(error="One of the items in your bag is invalid."), 400
        subtotal += item["price"] * quantity
        order_lines.append({"name": item["name"], "quantity": quantity})

    discount = min((subtotal + 5) // 10, 100) if promo_code else 0
    delivery_fee = (
        DELIVERY_FEE
        if fulfillment == "delivery" and subtotal < FREE_DELIVERY_THRESHOLD
        else 0
    )
    packaging_fee = PACKAGING_FEE if subtotal else 0
    gst = ((subtotal - discount) * 5 + 50) // 100
    total = subtotal - discount + delivery_fee + packaging_fee + gst
    order_id = uuid4().hex[:6].upper()
    return jsonify(
        id=order_id,
        name=name,
        phone=phone,
        pincode=pincode,
        fulfillment=fulfillment,
        items=order_lines,
        subtotal=subtotal,
        delivery_fee=delivery_fee,
        packaging_fee=packaging_fee,
        gst=gst,
        discount=discount,
        total=total,
        eta="35–45 min" if fulfillment == "delivery" else "Ready in 20–25 min",
        status="Confirmed",
    ), 201


if __name__ == "__main__":
    app.run(debug=True,port=5001)