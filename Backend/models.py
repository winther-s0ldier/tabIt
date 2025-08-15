from flask import current_app, g
import bcrypt
from bson.objectid import ObjectId
from pymongo.errors import DuplicateKeyError
from db import get_db
from datetime import datetime

def create_user(name, username, password, email):
    db = get_db()
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(rounds=12))
    try:
        db.users.insert_one({
            'name': name,
            'username': username,
            'password': hashed_password,
            'email': email,
            'created_at': datetime.utcnow(),
            'last_login': datetime.utcnow(),
            'tabs': []
        })
        return True
    except DuplicateKeyError:
        print(f"User creation error: Username or email already exists")
        return False
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return False

def authenticate_user(username, password):
    db = get_db()
    user = db.users.find_one({'username': username})
    if user:
        stored_password = user['password']
        if isinstance(stored_password, str):
            stored_password = stored_password.encode('utf-8')

        if bcrypt.checkpw(password.encode('utf-8'), stored_password):
            return user
    return None

def update_last_login(user_id):
    db = get_db()
    db.users.update_one(
        {'_id': ObjectId(user_id)},
        {'$set': {'last_login': datetime.utcnow()}}
    )

def get_user_by_id(user_id):
    db = get_db()
    user = db.users.find_one(
        {'_id': ObjectId(user_id)},
        {'password': 0}
    )
    return user

def save_tab(user_id, url, title, browser, state):
    db = get_db()
    tab_data = {
        'user_id': ObjectId(user_id),
        'url': url,
        'title': title,
        'browser': browser,
        'state': state,
        'first_opened': datetime.utcnow(),
        'last_opened': datetime.utcnow()
    }
    try:
        db.tabs.insert_one(tab_data)
        return True, None
    except Exception as e:
        error_message = f"Error saving tab data: {e}"
        print(error_message)
        return False, error_message

def get_tabs(user_id):
    db = get_db()
    return list(db.tabs.find({'user_id': ObjectId(user_id)}))