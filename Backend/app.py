from functools import wraps
import jwt
from flask import Flask, request, jsonify, g, make_response
from flask import current_app
import flask_cors
from auth import auth_bp
from models import save_tab, get_tabs
from db import close_db, init_db, get_db
import secrets
import os
from datetime import datetime, timedelta
from bson.objectid import ObjectId

secret_key = os.environ.get('SECRET_KEY', secrets.token_urlsafe(64))
mongo_uri = os.environ.get('MONGO_URI', 'mongodb://localhost:27017/')

app = Flask(__name__)
app.config['SECRET_KEY'] = secret_key
app.config['MONGO_URI'] = mongo_uri
app.config['MONGO_DBNAME'] = 'browser_tab_tracker'

ALLOWED_ORIGINS = [
    "http://localhost:63342",
    f"chrome-extension://{os.environ.get('CHROME_EXTENSION_ID', '')}"
]
flask_cors.CORS(app, resources={r"/*": {"origins": ALLOWED_ORIGINS}})

app.register_blueprint(auth_bp, url_prefix='/auth')

app.teardown_appcontext(close_db)

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        session_token = request.headers.get('Authorization')

        current_user_id = None

        if session_token:
            try:
                if session_token.startswith('Bearer '):
                    session_token = session_token.split()[1]
                data = jwt.decode(session_token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
                current_user_id = data['user_id']

                db = get_db()
                user = db.users.find_one({'_id': ObjectId(current_user_id)})
                if not user:
                    return jsonify({'message': 'User not found!'}), 401

            except jwt.ExpiredSignatureError:
                print("Session token has expired!")
                return jsonify({'message': 'Token has expired!'}), 401
            except jwt.InvalidTokenError:
                print("Invalid session token!")
                return jsonify({'message': 'Invalid token!'}), 401
            except Exception as e:
                print(f"Session token error: {e}")
                return jsonify({'message': 'Token error!'}), 401

        if not current_user_id:
            return jsonify({'message': 'Authentication required!'}), 401

        return f(current_user_id, *args, **kwargs)

    return decorated

@app.route('/save_tab', methods=['POST'])
@token_required
def save_tab_route(current_user_id):
    try:
        data = request.json
        required_keys = ['url', 'title', 'browser', 'state']
        if not all(key in data for key in required_keys):
            return jsonify({"message": "Missing required fields"}), 400

        success, error_message = save_tab(
            current_user_id,
            data['url'],
            data['title'],
            data['browser'],
            data['state']
        )

        if success:
            return jsonify({"message": "Tab saved successfully!"}), 201
        else:
            return jsonify({"message": f"Failed to save tab data: {error_message}"}), 500
    except Exception as e:
        print(f"Error saving tab data: {e}")
        return jsonify({"message": f"Failed to save tab data: {str(e)}"}), 500

@app.route('/save_tab/update_last_opened', methods=['POST'])
@token_required
def update_last_opened_route(current_user_id):
    try:
        data = request.json
        if not data or 'url' not in data:
            return jsonify({"message": "URL is required"}), 400

        db = get_db()
        result = db.tabs.update_one(
            {
                'user_id': ObjectId(current_user_id),
                'url': data['url']
            },
            {
                '$set': {
                    'last_opened': datetime.utcnow()
                }
            }
        )

        if result.modified_count > 0:
            return jsonify({"message": "Last opened time updated successfully"}), 200
        else:
            return jsonify({"message": "Tab not found"}), 404
    except Exception as e:
        print(f"Error updating last opened time: {e}")
        return jsonify({"message": "Failed to update last opened time"}), 500

@app.route('/update_tab_title', methods=['PUT'])
@token_required
def update_tab_title_route(current_user_id):
    try:
        data = request.json
        if not data or 'url' not in data or 'title' not in data:
            return jsonify({"message": "URL and title are required"}), 400

        db = get_db()
        result = db.tabs.update_one(
            {
                'user_id': ObjectId(current_user_id),
                'url': data['url']
            },
            {
                '$set': {
                    'title': data['title']
                }
            }
        )

        if result.modified_count > 0:
            return jsonify({"message": "Tab title updated successfully"}), 200
        else:
            return jsonify({"message": "Tab not found"}), 404
    except Exception as e:
        print(f"Error updating tab title: {e}")
        return jsonify({"message": "Failed to update tab title"}), 500

@app.route('/get_tabs', methods=['GET'])
@token_required
def get_tabs_route(current_user_id):
    try:
        tabs = get_tabs(current_user_id)
        for tab in tabs:
            tab['_id'] = str(tab['_id'])
            tab['user_id'] = str(tab['user_id'])
        return jsonify(tabs), 200
    except Exception as e:
        print(f"Error retrieving tab data: {e}")
        return jsonify({"message": "Failed to retrieve tab data"}), 500

@app.route('/delete_tab', methods=['DELETE'])
@token_required
def delete_tab_route(current_user_id):
    try:
        data = request.json
        if not data or 'url' not in data:
            return jsonify({"message": "URL is required"}), 400

        db = get_db()
        result = db.tabs.delete_one({
            'user_id': ObjectId(current_user_id),
            'url': data['url']
        })

        if result.deleted_count > 0:
            return jsonify({"message": "Tab deleted successfully"}), 200
        else:
            return jsonify({"message": "Tab not found"}), 404
    except Exception as e:
        print(f"Error deleting tab: {e}")
        return jsonify({"message": "Failed to delete tab"}), 500

if __name__ == '__main__':
    with app.app_context():
        init_db()
    app.run(debug=True, host='0.0.0.0', port=5000)