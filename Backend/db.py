from pymongo import MongoClient
from flask import current_app, g

def get_db():
    if 'db' not in g:
        client = MongoClient(current_app.config['MONGO_URI'])
        g.db = client[current_app.config['MONGO_DBNAME']]
    return g.db

def close_db(e=None):
    db = g.pop('db', None)
    if db is not None:
        db.client.close()

def init_db():
    db = get_db()
    db.users.create_index([("username", 1)], unique=True)
    db.users.create_index([("email", 1)], unique=True)
    db.tabs.create_index([("url", 1)])
    db.tabs.create_index([("user_id", 1)])