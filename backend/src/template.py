from copy import deepcopy


INSPECTION_TEMPLATE = {
    "name": "CAT Inspect Truck MVP",
    "header": [
        {"key": "truckSerialNumber", "label": "Truck Serial Number", "example": "7301234"},
        {"key": "truckModel", "label": "Truck Model", "example": "730 EJ"},
        {"key": "inspectorName", "label": "Inspector Name", "example": "Aarav Singh"},
        {"key": "employeeId", "label": "Inspection Employee ID", "example": "EMP-1042"},
        {"key": "location", "label": "Location of Inspection", "example": "Mine Bay 4"},
        {"key": "geoCoordinates", "label": "Geo Coordinates", "example": "12.9716, 77.5946"},
        {"key": "serviceMeterHours", "label": "Service Meter Hours", "example": "18250"},
        {"key": "customerName", "label": "Customer Name / Company", "example": "Atlas Quarry Ltd"},
        {"key": "catCustomerId", "label": "CAT Customer ID", "example": "CAT-88421"},
        {"key": "inspectorSignature", "label": "Inspector Signature", "example": "A. Singh"},
    ],
    "sections": [
        {
            "key": "tires",
            "title": "Tires",
            "questions": [
                {"key": "lfPressure", "label": "Tire Pressure for Left Front", "type": "value", "unit": "PSI"},
                {"key": "rfPressure", "label": "Tire Pressure for Right Front", "type": "value", "unit": "PSI"},
                {"key": "lfCondition", "label": "Tire Condition for Left Front", "type": "choice", "options": ["Good", "Ok", "Needs Replacement"]},
                {"key": "rfCondition", "label": "Tire Condition for Right Front", "type": "choice", "options": ["Good", "Ok", "Needs Replacement"]},
                {"key": "lrPressure", "label": "Tire Pressure for Left Rear", "type": "value", "unit": "PSI"},
                {"key": "rrPressure", "label": "Tire Pressure for Right Rear", "type": "value", "unit": "PSI"},
                {"key": "lrCondition", "label": "Tire Condition for Left Rear", "type": "choice", "options": ["Good", "Ok", "Needs Replacement"]},
                {"key": "rrCondition", "label": "Tire Condition for Right Rear", "type": "choice", "options": ["Good", "Ok", "Needs Replacement"]},
                {"key": "summary", "label": "Overall Tire Summary", "type": "notes", "maxLength": 1000},
            ],
        },
        {
            "key": "battery",
            "title": "Battery",
            "questions": [
                {"key": "make", "label": "Battery Make", "type": "text"},
                {"key": "replacementDate", "label": "Battery Replacement Date", "type": "date"},
                {"key": "voltage", "label": "Battery Voltage", "type": "value", "unit": "V"},
                {"key": "waterLevel", "label": "Battery Water Level", "type": "choice", "options": ["Good", "Ok", "Low"]},
                {"key": "damage", "label": "Condition of Battery Damage", "type": "yesno", "imageOnYes": True},
                {"key": "leakRust", "label": "Any Leak / Rust in Battery", "type": "yesno", "imageOnYes": True},
                {"key": "summary", "label": "Battery Overall Summary", "type": "notes", "maxLength": 1000},
            ],
        },
        {
            "key": "exterior",
            "title": "Exterior",
            "questions": [
                {"key": "rustDentDamage", "label": "Rust, Dent or Damage to Exterior", "type": "yesno", "imageOnYes": True},
                {"key": "suspensionOilLeak", "label": "Oil Leak in Suspension", "type": "yesno", "imageOnYes": True},
                {"key": "summary", "label": "Exterior Overall Summary", "type": "notes", "maxLength": 1000},
            ],
        },
        {
            "key": "brakes",
            "title": "Brakes",
            "questions": [
                {"key": "fluidLevel", "label": "Brake Fluid Level", "type": "choice", "options": ["Good", "Ok", "Low"]},
                {"key": "frontCondition", "label": "Brake Condition for Front", "type": "choice", "options": ["Good", "Ok", "Needs Replacement"]},
                {"key": "rearCondition", "label": "Brake Condition for Rear", "type": "choice", "options": ["Good", "Ok", "Needs Replacement"]},
                {"key": "emergencyBrake", "label": "Emergency Brake", "type": "choice", "options": ["Good", "Ok", "Low"]},
                {"key": "summary", "label": "Brake Overall Summary", "type": "notes", "maxLength": 1000},
            ],
        },
        {
            "key": "engine",
            "title": "Engine",
            "questions": [
                {"key": "damage", "label": "Rust, Dents or Damage in Engine", "type": "yesno", "imageOnYes": True},
                {"key": "oilCondition", "label": "Engine Oil Condition", "type": "choice", "options": ["Good", "Bad"]},
                {"key": "oilColor", "label": "Engine Oil Color", "type": "text"},
                {"key": "brakeFluidCondition", "label": "Brake Fluid Condition", "type": "choice", "options": ["Good", "Bad"]},
                {"key": "brakeFluidColor", "label": "Brake Fluid Color", "type": "text"},
                {"key": "oilLeak", "label": "Any Oil Leak in Engine", "type": "yesno", "imageOnYes": True},
                {"key": "summary", "label": "Engine Overall Summary", "type": "notes", "maxLength": 1000},
            ],
        },
        {
            "key": "voiceOfCustomer",
            "title": "Voice of Customer",
            "questions": [
                {"key": "feedback", "label": "Customer Feedback", "type": "notes", "maxLength": 1000},
                {"key": "issueImages", "label": "Images Related to Customer Issues", "type": "image"},
            ],
        },
    ],
}


def get_template():
    return deepcopy(INSPECTION_TEMPLATE)
