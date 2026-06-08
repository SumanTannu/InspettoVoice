from datetime import datetime
from uuid import uuid4

from pymongo import MongoClient
from pymongo.errors import PyMongoError

from .config import Config


class InspectionRepository:
    def __init__(self):
        self.memory = []
        self.collection = None
        if Config.MONGO_URI:
            try:
                client = MongoClient(Config.MONGO_URI, serverSelectionTimeoutMS=800)
                client.admin.command("ping")
                self.collection = client[Config.MONGO_DB]["inspections"]
            except PyMongoError:
                self.collection = None

    def _next_report_id(self):
        current_count = len(self.list_recent(10000))
        return f"CAT-{current_count + 1:05d}"

    def _serialize(self, document):
        if document and "_id" in document:
            document["_id"] = str(document["_id"])
        return document

    def create(self, payload):
        report_id = payload.get("inspectionId") or self._next_report_id()
        document = {
            "_id": uuid4().hex,
            "inspectionId": report_id,
            "status": payload.get("status", "in_progress"),
            "createdAt": datetime.utcnow().isoformat() + "Z",
            "updatedAt": datetime.utcnow().isoformat() + "Z",
            **payload,
        }
        if self.collection is None:
            self.memory.insert(0, document)
        else:
            self.collection.insert_one(document)
        return self._serialize(document)

    def list_recent(self, limit=20):
        if self.collection is None:
            return self.memory[:limit]
        return [self._serialize(item) for item in self.collection.find().sort("createdAt", -1).limit(limit)]

    def find_by_report_id(self, inspection_id):
        if self.collection is None:
            return next((item for item in self.memory if item.get("inspectionId") == inspection_id or item.get("_id") == inspection_id), None)
        return self._serialize(self.collection.find_one({"$or": [{"inspectionId": inspection_id}, {"_id": inspection_id}]}))

    def search(self, query="", status=""):
        query = query.lower().strip()
        items = self.list_recent(10000)
        if status:
            items = [item for item in items if item.get("status") == status]
        if not query:
            return items[:50]
        return [
            item
            for item in items
            if query in item.get("inspectionId", "").lower()
            or query in item.get("header", {}).get("truckSerialNumber", "").lower()
            or query in item.get("header", {}).get("customerName", "").lower()
        ][:50]

    def update(self, inspection_id, patch):
        patch["updatedAt"] = datetime.utcnow().isoformat() + "Z"
        if self.collection is None:
            for index, item in enumerate(self.memory):
                if item.get("inspectionId") == inspection_id or item.get("_id") == inspection_id:
                    self.memory[index] = {**item, **patch}
                    return self.memory[index]
            return None

        self.collection.update_one({"$or": [{"inspectionId": inspection_id}, {"_id": inspection_id}]}, {"$set": patch})
        return self.find_by_report_id(inspection_id)
