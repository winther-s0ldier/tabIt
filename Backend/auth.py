from bson import ObjectId
from flask import Blueprint, request, jsonify
from models import create_user, authenticate_user, update_last_login, get_user_by_id
import jwt
from datetime import datetime, timedelta
from flask import current_app
import secrets
from db import get_db
import bcrypt

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.json
    name = data.get('name')
    username = data.get('username')
    password = data.get('password')
    email = data.get('email')

    if not name or not username or not password or not email:
        return jsonify({'message': 'Name, username, password, and email are required'}), 400
    if len(password) < 8:
        return jsonify({'message': 'Password must be at least 8 characters long'}), 400

    if create_user(name, username, password, email):
        return jsonify({'message': 'User registered successfully'}), 201
    else:
        return jsonify({'message': 'Username or email already exists'}), 409

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    user = authenticate_user(username, password)
    if user:
        update_last_login(user['_id'])

        session_expiration = datetime.utcnow() + timedelta(days=90)
        session_token = jwt.encode({
            'user_id': str(user['_id']),
            'exp': session_expiration
        }, current_app.config['SECRET_KEY'], algorithm='HS256')

        response_data = {
            'token': session_token,
            'user_id': str(user['_id']),
            'tokenExpiration': session_expiration.timestamp() * 1000
        }

        return jsonify(response_data), 200
    else:
        return jsonify({'message': 'Invalid username or password'}), 401

@auth_bp.route('/revalidate', methods=['POST'])
def revalidate():
    token = request.headers.get('Authorization').split(" ")[1]
    data = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
    user_id = data['user_id']

    password = request.json.get('password')

    db = get_db()
    user = db.users.find_one({'_id': ObjectId(user_id)})

    if user and bcrypt.checkpw(password.encode('utf-8'), user['password']):
        session_expiration = datetime.utcnow() + timedelta(days=90)
        session_token = jwt.encode({
            'user_id': str(user['_id']),
            'exp': session_expiration
        }, current_app.config['SECRET_KEY'], algorithm='HS256')

        return jsonify({
            'token': session_token,
            'tokenExpiration': session_expiration.timestamp() * 1000
        }), 200
    else:
        return jsonify({'message': 'Invalid password'}), 401

@auth_bp.route('/user/<string:user_id>', methods=['GET'])
def get_user(user_id):
    user = get_user_by_id(user_id)
    if user:
        user['_id'] = str(user['_id'])
        user['created_at'] = user['created_at'].isoformat() if user['created_at'] else None
        return jsonify(user), 200
    else:
        return jsonify({'message': 'User not found'}), 404