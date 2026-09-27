export interface BusinessCategorySeed {
  name: string;
  industry_type: string;
  currency: string;
  default_tax: number;
  stock_alert_limit: number;
  enabled_modules: string[];
}

export interface ProductCategorySeed {
  name: string;
  slug: string;
  parent_name?: string | null;
  description?: string;
  industry_assignments: string[];
  inherit_expiry?: boolean;
  inherit_batch?: boolean;
  inherit_barcode?: boolean;
  inherit_alerts?: boolean;
}

export const REAL_BUSINESS_CATEGORIES: BusinessCategorySeed[] = [
  { name: "Pharmacy & Health Store", industry_type: "Pharmacy", currency: "USD", default_tax: 0, stock_alert_limit: 15, enabled_modules: ["dashboard", "inventory", "pos", "purchases", "returns", "reports"] },
  { name: "Supermarket & Hypermarket", industry_type: "Supermarket", currency: "USD", default_tax: 5, stock_alert_limit: 20, enabled_modules: ["dashboard", "inventory", "pos", "purchases", "returns", "reports"] },
  { name: "Grocery Store & Minimart", industry_type: "Grocery", currency: "USD", default_tax: 0, stock_alert_limit: 10, enabled_modules: ["dashboard", "inventory", "pos", "purchases", "returns", "reports"] },
  { name: "Electronics & Gadgets", industry_type: "Electronics", currency: "USD", default_tax: 5, stock_alert_limit: 5, enabled_modules: ["dashboard", "inventory", "pos", "purchases", "returns", "reports", "analytics"] },
  { name: "Mobile Phones & Telecommunication", industry_type: "Mobile Shop", currency: "USD", default_tax: 5, stock_alert_limit: 5, enabled_modules: ["dashboard", "inventory", "pos", "purchases", "returns", "reports"] },
  { name: "Computer & IT Hardware", industry_type: "IT Store", currency: "USD", default_tax: 5, stock_alert_limit: 5, enabled_modules: ["dashboard", "inventory", "pos", "purchases", "returns", "reports"] },
  { name: "Fashion & Apparel Boutique", industry_type: "Boutique", currency: "USD", default_tax: 5, stock_alert_limit: 10, enabled_modules: ["dashboard", "inventory", "pos", "purchases", "returns", "reports"] },
  { name: "Footwear & Shoes", industry_type: "Footwear", currency: "USD", default_tax: 5, stock_alert_limit: 10, enabled_modules: ["dashboard", "inventory", "pos", "purchases", "returns", "reports"] },
  { name: "Restaurant & Dine-In", industry_type: "Restaurant", currency: "USD", default_tax: 8, stock_alert_limit: 25, enabled_modules: ["dashboard", "inventory", "pos", "purchases", "reports"] },
  { name: "Fast Food & Quick Service", industry_type: "Fast Food", currency: "USD", default_tax: 8, stock_alert_limit: 25, enabled_modules: ["dashboard", "inventory", "pos", "purchases", "reports"] },
  { name: "Cafe & Coffee Shop", industry_type: "Cafe", currency: "USD", default_tax: 5, stock_alert_limit: 15, enabled_modules: ["dashboard", "inventory", "pos", "purchases", "reports"] },
  { name: "Bakery & Pastry Shop", industry_type: "Bakery", currency: "USD", default_tax: 0, stock_alert_limit: 20, enabled_modules: ["dashboard", "inventory", "pos", "purchases", "returns", "reports"] },
  { name: "Hardware, Tools & Construction", industry_type: "Hardware", currency: "USD", default_tax: 5, stock_alert_limit: 15, enabled_modules: ["dashboard", "inventory", "pos", "purchases", "returns", "reports"] },
  { name: "Electrical & Lighting Supplies", industry_type: "Electrical", currency: "USD", default_tax: 5, stock_alert_limit: 10, enabled_modules: ["dashboard", "inventory", "pos", "purchases", "returns", "reports"] },
  { name: "Plumbing & Sanitary Ware", industry_type: "Plumbing", currency: "USD", default_tax: 5, stock_alert_limit: 10, enabled_modules: ["dashboard", "inventory", "pos", "purchases", "returns", "reports"] },
  { name: "Auto Parts & Accessories", industry_type: "Automotive", currency: "USD", default_tax: 5, stock_alert_limit: 8, enabled_modules: ["dashboard", "inventory", "pos", "purchases", "returns", "reports"] },
  { name: "Vehicle Repair & Service Garage", industry_type: "Repair Shop", currency: "USD", default_tax: 5, stock_alert_limit: 5, enabled_modules: ["dashboard", "inventory", "pos", "purchases", "reports"] },
  { name: "Cosmetics, Beauty & Skincare", industry_type: "Beauty", currency: "USD", default_tax: 5, stock_alert_limit: 12, enabled_modules: ["dashboard", "inventory", "pos", "purchases", "returns", "reports"] },
  { name: "Hair Salon & Barbershop", industry_type: "Salon", currency: "USD", default_tax: 5, stock_alert_limit: 10, enabled_modules: ["dashboard", "inventory", "pos", "reports"] },
  { name: "Bookstore & Stationery", industry_type: "Books & Stationery", currency: "USD", default_tax: 0, stock_alert_limit: 15, enabled_modules: ["dashboard", "inventory", "pos", "purchases", "returns", "reports"] },
  { name: "Jewelry, Watches & Luxury Goods", industry_type: "Jewelry", currency: "USD", default_tax: 5, stock_alert_limit: 3, enabled_modules: ["dashboard", "inventory", "pos", "purchases", "returns", "reports"] },
  { name: "Home Furniture & Living", industry_type: "Furniture", currency: "USD", default_tax: 5, stock_alert_limit: 5, enabled_modules: ["dashboard", "inventory", "pos", "purchases", "returns", "reports"] },
  { name: "Home Appliances & Kitchenware", industry_type: "Home Goods", currency: "USD", default_tax: 5, stock_alert_limit: 5, enabled_modules: ["dashboard", "inventory", "pos", "purchases", "returns", "reports"] },
  { name: "Sports, Gym & Fitness Equipment", industry_type: "Sports", currency: "USD", default_tax: 5, stock_alert_limit: 8, enabled_modules: ["dashboard", "inventory", "pos", "purchases", "returns", "reports"] },
  { name: "Pet Shop & Veterinary Supplies", industry_type: "Pet Care", currency: "USD", default_tax: 5, stock_alert_limit: 10, enabled_modules: ["dashboard", "inventory", "pos", "purchases", "returns", "reports"] },
  { name: "Optometry & Eyewear Store", industry_type: "Optical", currency: "USD", default_tax: 5, stock_alert_limit: 5, enabled_modules: ["dashboard", "inventory", "pos", "purchases", "returns", "reports"] },
  { name: "Wholesale & Distribution Hub", industry_type: "Wholesale", currency: "USD", default_tax: 0, stock_alert_limit: 50, enabled_modules: ["dashboard", "inventory", "pos", "purchases", "returns", "reports", "analytics"] },
  { name: "Agriculture & Farming Supplies", industry_type: "Agriculture", currency: "USD", default_tax: 0, stock_alert_limit: 25, enabled_modules: ["dashboard", "inventory", "pos", "purchases", "returns", "reports"] },
  { name: "General Retail & Department Store", industry_type: "Retail", currency: "USD", default_tax: 5, stock_alert_limit: 20, enabled_modules: ["dashboard", "inventory", "pos", "purchases", "returns", "reports", "analytics"] },
];

export const REAL_PRODUCT_CATEGORIES: ProductCategorySeed[] = [
  // Pharmacy (10)
  { name: "Prescription Medicines", slug: "prescription-medicines", industry_assignments: ["Pharmacy"], inherit_expiry: true, inherit_batch: true, inherit_barcode: true, inherit_alerts: true },
  { name: "Over-The-Counter (OTC)", slug: "over-the-counter-otc", industry_assignments: ["Pharmacy", "Supermarket"], inherit_expiry: true, inherit_batch: true, inherit_barcode: true, inherit_alerts: true },
  { name: "Antibiotics & Antivirals", slug: "antibiotics-antivirals", parent_name: "Prescription Medicines", industry_assignments: ["Pharmacy"], inherit_expiry: true, inherit_batch: true, inherit_barcode: true, inherit_alerts: true },
  { name: "Pain Relief & Analgesics", slug: "pain-relief-analgesics", parent_name: "Over-The-Counter (OTC)", industry_assignments: ["Pharmacy", "Supermarket"], inherit_expiry: true, inherit_batch: true, inherit_barcode: true, inherit_alerts: true },
  { name: "Cold, Flu & Cough Remedies", slug: "cold-flu-cough", parent_name: "Over-The-Counter (OTC)", industry_assignments: ["Pharmacy"], inherit_expiry: true, inherit_batch: true, inherit_barcode: true, inherit_alerts: true },
  { name: "First Aid & Surgical Supplies", slug: "first-aid-surgical", industry_assignments: ["Pharmacy", "Hospital Pharmacy"], inherit_expiry: true, inherit_batch: true, inherit_barcode: true, inherit_alerts: true },
  { name: "Vitamins & Dietary Supplements", slug: "vitamins-dietary-supplements", industry_assignments: ["Pharmacy", "Supermarket"], inherit_expiry: true, inherit_batch: true, inherit_barcode: true, inherit_alerts: false },
  { name: "Skin Care & Dermatological", slug: "skincare-dermatological", industry_assignments: ["Pharmacy", "Beauty"], inherit_expiry: true, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Baby & Maternal Healthcare", slug: "baby-maternal-health", industry_assignments: ["Pharmacy", "Supermarket"], inherit_expiry: true, inherit_batch: true, inherit_barcode: true, inherit_alerts: true },
  { name: "Diagnostic Tests & Medical Devices", slug: "diagnostic-tests-devices", industry_assignments: ["Pharmacy"], inherit_expiry: true, inherit_batch: true, inherit_barcode: true, inherit_alerts: true },

  // Grocery & Supermarket (16)
  { name: "Fresh Fruits & Vegetables", slug: "fresh-fruits-vegetables", industry_assignments: ["Supermarket", "Grocery"], inherit_expiry: true, inherit_batch: false, inherit_barcode: false, inherit_alerts: true },
  { name: "Dairy, Cheese & Milk", slug: "dairy-cheese-milk", industry_assignments: ["Supermarket", "Grocery"], inherit_expiry: true, inherit_batch: true, inherit_barcode: true, inherit_alerts: true },
  { name: "Fresh Meat & Poultry", slug: "fresh-meat-poultry", industry_assignments: ["Supermarket", "Grocery"], inherit_expiry: true, inherit_batch: true, inherit_barcode: false, inherit_alerts: true },
  { name: "Seafood & Fish", slug: "seafood-fish", industry_assignments: ["Supermarket", "Grocery"], inherit_expiry: true, inherit_batch: false, inherit_barcode: false, inherit_alerts: true },
  { name: "Bakery & Fresh Bread", slug: "bakery-fresh-bread", industry_assignments: ["Supermarket", "Bakery"], inherit_expiry: true, inherit_batch: false, inherit_barcode: true, inherit_alerts: true },
  { name: "Pantry & Grains", slug: "pantry-grains", industry_assignments: ["Supermarket", "Grocery", "Wholesale"], inherit_expiry: true, inherit_batch: true, inherit_barcode: true, inherit_alerts: false },
  { name: "Cooking Oils & Ghee", slug: "cooking-oils-ghee", parent_name: "Pantry & Grains", industry_assignments: ["Supermarket", "Grocery"], inherit_expiry: true, inherit_batch: true, inherit_barcode: true, inherit_alerts: false },
  { name: "Spices & Seasonings", slug: "spices-seasonings", parent_name: "Pantry & Grains", industry_assignments: ["Supermarket", "Grocery"], inherit_expiry: true, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Beverages & Juices", slug: "beverages-juices", industry_assignments: ["Supermarket", "Grocery", "Restaurant"], inherit_expiry: true, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Soft Drinks & Carbonated", slug: "soft-drinks-carbonated", parent_name: "Beverages & Juices", industry_assignments: ["Supermarket", "Grocery", "Fast Food"], inherit_expiry: true, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Snacks & Confectionery", slug: "snacks-confectionery", industry_assignments: ["Supermarket", "Grocery"], inherit_expiry: true, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Chocolates & Sweets", slug: "chocolates-sweets", parent_name: "Snacks & Confectionery", industry_assignments: ["Supermarket", "Grocery"], inherit_expiry: true, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Canned & Packaged Food", slug: "canned-packaged-food", industry_assignments: ["Supermarket", "Grocery"], inherit_expiry: true, inherit_batch: true, inherit_barcode: true, inherit_alerts: false },
  { name: "Frozen Foods & Ice Cream", slug: "frozen-foods-icecream", industry_assignments: ["Supermarket", "Grocery"], inherit_expiry: true, inherit_batch: true, inherit_barcode: true, inherit_alerts: true },
  { name: "Breakfast Cereals & Oats", slug: "breakfast-cereals-oats", industry_assignments: ["Supermarket", "Grocery"], inherit_expiry: true, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Tea & Roasted Coffee", slug: "tea-roasted-coffee", industry_assignments: ["Supermarket", "Cafe"], inherit_expiry: true, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },

  // Household & Cleaning (5)
  { name: "Household & Cleaning", slug: "household-cleaning", industry_assignments: ["Supermarket", "Grocery", "Retail"], inherit_expiry: false, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Laundry Detergents & Fabric Care", slug: "laundry-detergents", parent_name: "Household & Cleaning", industry_assignments: ["Supermarket", "Grocery"], inherit_expiry: false, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Dishwashing Liquids & Tablets", slug: "dishwashing-products", parent_name: "Household & Cleaning", industry_assignments: ["Supermarket", "Grocery"], inherit_expiry: false, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Surface Cleaners & Disinfectants", slug: "surface-cleaners", parent_name: "Household & Cleaning", industry_assignments: ["Supermarket", "Grocery"], inherit_expiry: false, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Paper Towels, Tissues & Napkins", slug: "paper-towels-tissues", parent_name: "Household & Cleaning", industry_assignments: ["Supermarket", "Grocery"], inherit_expiry: false, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },

  // Personal Care & Cosmetics (7)
  { name: "Personal Care & Hygiene", slug: "personal-care-hygiene", industry_assignments: ["Supermarket", "Beauty", "Pharmacy"], inherit_expiry: true, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Hair Care & Shampoos", slug: "hair-care-shampoos", parent_name: "Personal Care & Hygiene", industry_assignments: ["Beauty", "Salon", "Supermarket"], inherit_expiry: true, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Oral Care & Toothpastes", slug: "oral-care-toothpastes", parent_name: "Personal Care & Hygiene", industry_assignments: ["Pharmacy", "Supermarket"], inherit_expiry: true, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Soaps, Shower Gels & Body Wash", slug: "bath-soaps-bodywash", parent_name: "Personal Care & Hygiene", industry_assignments: ["Supermarket", "Beauty"], inherit_expiry: true, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Deodorants & Perfumes", slug: "deodorants-fragrances", industry_assignments: ["Beauty", "Supermarket"], inherit_expiry: true, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Color Cosmetics & Makeup", slug: "makeup-cosmetics", industry_assignments: ["Beauty"], inherit_expiry: true, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Shaving & Mens Grooming", slug: "shaving-grooming", industry_assignments: ["Salon", "Supermarket"], inherit_expiry: false, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },

  // Electronics & IT (12)
  { name: "Consumer Electronics", slug: "consumer-electronics", industry_assignments: ["Electronics", "Retail"], inherit_expiry: false, inherit_batch: true, inherit_barcode: true, inherit_alerts: true },
  { name: "Smartphones & Mobile Devices", slug: "smartphones-mobile-devices", parent_name: "Consumer Electronics", industry_assignments: ["Mobile Shop", "Electronics"], inherit_expiry: false, inherit_batch: true, inherit_barcode: true, inherit_alerts: true },
  { name: "Tablets & E-Readers", slug: "tablets-ereaders", parent_name: "Consumer Electronics", industry_assignments: ["Mobile Shop", "Electronics"], inherit_expiry: false, inherit_batch: true, inherit_barcode: true, inherit_alerts: true },
  { name: "Laptops & Ultrabooks", slug: "laptops-ultrabooks", industry_assignments: ["IT Store", "Electronics"], inherit_expiry: false, inherit_batch: true, inherit_barcode: true, inherit_alerts: true },
  { name: "Desktop Computers & Workstations", slug: "desktops-workstations", industry_assignments: ["IT Store"], inherit_expiry: false, inherit_batch: true, inherit_barcode: true, inherit_alerts: false },
  { name: "Computer Monitors & Displays", slug: "monitors-displays", industry_assignments: ["IT Store", "Electronics"], inherit_expiry: false, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "PC Components & Motherboards", slug: "pc-components-motherboards", industry_assignments: ["IT Store"], inherit_expiry: false, inherit_batch: true, inherit_barcode: true, inherit_alerts: false },
  { name: "Storage Drives, SSDs & Flash", slug: "storage-drives-ssd", industry_assignments: ["IT Store", "Electronics"], inherit_expiry: false, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Keyboards, Mice & Input Devices", slug: "keyboards-mice-accessories", industry_assignments: ["IT Store", "Electronics"], inherit_expiry: false, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Headphones, Earbuds & Audio", slug: "headphones-earbuds-audio", industry_assignments: ["Electronics", "Mobile Shop"], inherit_expiry: false, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Cables, Chargers & Fast Adapters", slug: "cables-chargers-adapters", industry_assignments: ["Mobile Shop", "Electronics"], inherit_expiry: false, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Power Banks & Portable Power", slug: "power-banks-battery-packs", industry_assignments: ["Mobile Shop", "Electronics"], inherit_expiry: false, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },

  // Fashion & Apparel (10)
  { name: "Fashion & Clothing", slug: "fashion-clothing", industry_assignments: ["Boutique", "Retail"], inherit_expiry: false, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Mens Casual Shirts & Tees", slug: "mens-casual-shirts", parent_name: "Fashion & Clothing", industry_assignments: ["Boutique", "Retail"], inherit_expiry: false, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Mens Trousers, Jeans & Chinos", slug: "mens-trousers-jeans", parent_name: "Fashion & Clothing", industry_assignments: ["Boutique", "Retail"], inherit_expiry: false, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Mens Formal Suits & Blazers", slug: "mens-suits-blazers", parent_name: "Fashion & Clothing", industry_assignments: ["Boutique"], inherit_expiry: false, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Womens Tops, Blouses & Tees", slug: "womens-tops-blouses", parent_name: "Fashion & Clothing", industry_assignments: ["Boutique", "Retail"], inherit_expiry: false, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Womens Dresses & Gowns", slug: "womens-dresses-gowns", parent_name: "Fashion & Clothing", industry_assignments: ["Boutique"], inherit_expiry: false, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Kids & Toddler Clothing", slug: "kids-toddler-clothing", parent_name: "Fashion & Clothing", industry_assignments: ["Boutique", "Retail"], inherit_expiry: false, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Undergarments & Loungewear", slug: "innerwear-loungewear", parent_name: "Fashion & Clothing", industry_assignments: ["Boutique", "Retail"], inherit_expiry: false, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Winter Jackets, Coats & Hoodies", slug: "winter-jackets-hoodies", parent_name: "Fashion & Clothing", industry_assignments: ["Boutique", "Retail"], inherit_expiry: false, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Fashion Belts, Wallets & Bags", slug: "belts-wallets-accessories", industry_assignments: ["Boutique", "Retail"], inherit_expiry: false, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },

  // Footwear (5)
  { name: "Footwear & Shoes", slug: "footwear-collection", industry_assignments: ["Footwear", "Retail"], inherit_expiry: false, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Mens Casual & Athletic Shoes", slug: "mens-casual-athletic-shoes", parent_name: "Footwear & Shoes", industry_assignments: ["Footwear"], inherit_expiry: false, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Mens Formal Leather Shoes", slug: "mens-formal-leather-shoes", parent_name: "Footwear & Shoes", industry_assignments: ["Footwear"], inherit_expiry: false, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Womens Heels, Flats & Pumps", slug: "womens-heels-flats", parent_name: "Footwear & Shoes", industry_assignments: ["Footwear"], inherit_expiry: false, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Sandals, Slides & House Slippers", slug: "sandals-slippers", parent_name: "Footwear & Shoes", industry_assignments: ["Footwear", "Retail"], inherit_expiry: false, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },

  // Food & Dining / Restaurant (8)
  { name: "Appetizers & Finger Food", slug: "appetizers-finger-food", industry_assignments: ["Restaurant", "Fast Food"], inherit_expiry: true, inherit_batch: false, inherit_barcode: false, inherit_alerts: false },
  { name: "Main Entrees & Dishes", slug: "main-entrees-dishes", industry_assignments: ["Restaurant"], inherit_expiry: true, inherit_batch: false, inherit_barcode: false, inherit_alerts: false },
  { name: "Artisan Pizzas & Pastas", slug: "pizzas-italian-specialties", industry_assignments: ["Restaurant", "Fast Food"], inherit_expiry: true, inherit_batch: false, inherit_barcode: false, inherit_alerts: false },
  { name: "Burgers, Wraps & Sandwiches", slug: "burgers-wraps-sandwiches", industry_assignments: ["Fast Food", "Cafe"], inherit_expiry: true, inherit_batch: false, inherit_barcode: false, inherit_alerts: false },
  { name: "BBQ, Grills & Steaks", slug: "bbq-grills-steaks", industry_assignments: ["Restaurant"], inherit_expiry: true, inherit_batch: false, inherit_barcode: false, inherit_alerts: false },
  { name: "Soups, Salads & Healthy Bowls", slug: "soups-salads-bowls", industry_assignments: ["Restaurant", "Cafe"], inherit_expiry: true, inherit_batch: false, inherit_barcode: false, inherit_alerts: false },
  { name: "Desserts, Cakes & Pastries", slug: "desserts-pastries-cakes", industry_assignments: ["Bakery", "Cafe", "Restaurant"], inherit_expiry: true, inherit_batch: false, inherit_barcode: true, inherit_alerts: true },
  { name: "Specialty Coffee & Frappes", slug: "specialty-coffee-frappes", industry_assignments: ["Cafe", "Restaurant"], inherit_expiry: true, inherit_batch: false, inherit_barcode: false, inherit_alerts: false },

  // Hardware & Tools (8)
  { name: "Hardware & Construction Tools", slug: "hardware-construction-tools", industry_assignments: ["Hardware"], inherit_expiry: false, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Power Tools & Cordless Drills", slug: "power-tools-machinery", parent_name: "Hardware & Construction Tools", industry_assignments: ["Hardware"], inherit_expiry: false, inherit_batch: true, inherit_barcode: true, inherit_alerts: false },
  { name: "Hand Tools, Wrenches & Pliers", slug: "hand-tools-measuring", parent_name: "Hardware & Construction Tools", industry_assignments: ["Hardware"], inherit_expiry: false, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Fasteners, Bolts, Nuts & Screws", slug: "fasteners-screws-hardware", parent_name: "Hardware & Construction Tools", industry_assignments: ["Hardware", "Wholesale"], inherit_expiry: false, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Measuring Tapes, Lasers & Levels", slug: "measuring-lasers-levels", parent_name: "Hardware & Construction Tools", industry_assignments: ["Hardware"], inherit_expiry: false, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Safety Equipment, Helmets & Gloves", slug: "safety-equipment-ppe", parent_name: "Hardware & Construction Tools", industry_assignments: ["Hardware", "Wholesale"], inherit_expiry: false, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Paints, Primers & Spray Cans", slug: "paints-primers-coatings", industry_assignments: ["Hardware"], inherit_expiry: true, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Adhesives, Epoxies & Silicone Sealants", slug: "adhesives-sealants-glues", industry_assignments: ["Hardware"], inherit_expiry: true, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },

  // Electrical & Plumbing (5)
  { name: "LED Lights, Bulbs & Chandeliers", slug: "led-lighting-fixtures", industry_assignments: ["Electrical", "Hardware"], inherit_expiry: false, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Electrical Wires, Switches & Circuit Breakers", slug: "electrical-wires-switches", industry_assignments: ["Electrical", "Hardware"], inherit_expiry: false, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "PVC Pipes & Plumbing Fittings", slug: "pvc-pipes-fittings", industry_assignments: ["Plumbing", "Hardware"], inherit_expiry: false, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Water Taps, Valves & Mixers", slug: "water-valves-taps", industry_assignments: ["Plumbing", "Hardware"], inherit_expiry: false, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Water Pumps, Pressure Tanks & Geysers", slug: "water-pumps-tanks", industry_assignments: ["Plumbing", "Hardware"], inherit_expiry: false, inherit_batch: true, inherit_barcode: true, inherit_alerts: false },

  // Automotive (5)
  { name: "Engine Oils, Coolants & Lubricants", slug: "engine-oils-lubricants", industry_assignments: ["Automotive", "Repair Shop"], inherit_expiry: true, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Car Batteries & Terminals", slug: "car-batteries-chargers", industry_assignments: ["Automotive", "Repair Shop"], inherit_expiry: false, inherit_batch: true, inherit_barcode: true, inherit_alerts: true },
  { name: "Brake Pads, Shoes & Rotors", slug: "brake-pads-rotors", industry_assignments: ["Automotive", "Repair Shop"], inherit_expiry: false, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Tires, Inner Tubes & Valves", slug: "tires-wheels-valves", industry_assignments: ["Automotive", "Repair Shop"], inherit_expiry: false, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Air, Oil & Fuel Filters", slug: "auto-filters-spark-plugs", industry_assignments: ["Automotive", "Repair Shop"], inherit_expiry: false, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },

  // Sports, Pet & Stationery (5)
  { name: "Fitness Dumbbells, Mats & Gym Gear", slug: "fitness-gym-gear", industry_assignments: ["Sports"], inherit_expiry: false, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Sports Balls, Bats & Racquets", slug: "sports-balls-racquets", industry_assignments: ["Sports"], inherit_expiry: false, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "Pet Nutrition & Dog/Cat Food", slug: "pet-food-nutrition", industry_assignments: ["Pet Care", "Supermarket"], inherit_expiry: true, inherit_batch: true, inherit_barcode: true, inherit_alerts: true },
  { name: "Office Stationery, Files & Paper Reams", slug: "office-stationery-files", industry_assignments: ["Books & Stationery", "Office"], inherit_expiry: false, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
  { name: "School Books, Notebooks & Writing Pens", slug: "school-books-pens", industry_assignments: ["Books & Stationery", "Retail"], inherit_expiry: false, inherit_batch: false, inherit_barcode: true, inherit_alerts: false },
];
