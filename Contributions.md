# Contributing to TABit

Thank you for your interest in contributing to TABit! We welcome contributions from everyone.

## Development Setup

### Prerequisites

*   **Python 3.8+:** Make sure you have Python 3.8 or a newer version installed.
*   **Node.js and npm:** You'll need Node.js and npm to install frontend dependencies (specifically `js-cookie`).
*   **MongoDB:** You need a running MongoDB instance. You can install it locally or use a cloud service like MongoDB Atlas.
*   **Git:** Git is used for version control.

### Installation Steps

1. **Clone the Repository:**

    ```bash
    git clone <repository-url>
    cd TABit
    ```

2. **Backend Setup:**

    *   **Create a Virtual Environment (recommended):**

        ```bash
        python3 -m venv venv
        source venv/bin/activate  # On Linux/macOS
        venv\Scripts\activate  # On Windows
        ```

    *   **Install Backend Dependencies:**

        ```bash
        cd Backend
        pip install -r requirements.txt
        ```

    *   **Set Environment Variables:**
        *   Create a `.env` file in the `Backend` directory.
        *   Add the following environment variables, replacing the values with your actual configuration:

            ```
            SECRET_KEY=<your-secret-key>
            MONGO_URI=<your-mongodb-uri>
            ```

            **Important:**
            *   `SECRET_KEY`: Generate a strong, random secret key.
            *   `MONGO_URI`: This is the connection string for your MongoDB database.

3. **Frontend Setup:**

    *   **Install Frontend Dependencies:**

        ```bash
        cd ../Extension  # Navigate to the Extension directory
        npm install
        ```

### Running the Application

1. **Start the Backend:**

    ```bash
    cd ../Backend  # Make sure you are in the Backend directory
    flask run --debug --port 5000
    ```
    The `--debug` flag enables debug mode with automatic reloading, which is very helpful during development.
2. **Load the Extension in Your Browser:**

    *   **Chrome:**
        1. Open Chrome and go to `chrome://extensions/`.
        2. Enable "Developer mode" (usually a toggle in the top right corner).
        3. Click the "Load unpacked" button.
        4. Select the `Extension` folder in your TABit project directory.

    *   **Firefox:**
        1. Open Firefox and go to `about:debugging`.
        2. Click "This Firefox" on the left sidebar.
        3. Click "Load Temporary Add-on...".
        4. Select the `manifest.json` file within the `Extension` folder.

### Development Workflow

*   **Backend Changes:** When you modify the backend code (e.g., `app.py`, `auth.py`), the Flask development server will automatically reload if you have debug mode enabled.
*   **Frontend Changes:**
    *   For changes in `background.js`, you'll need to manually reload the extension in your browser.
    *   For changes in `popup.html`, `popup.js`, `login.html`, `login.js`, `webpage.html`, or `webpage.js`, simply closing and reopening the popup or refreshing the relevant pages might be sufficient.
    *   If you make changes to how `background.js` interacts with the backend API, it's recommended to reload the extension.
*   **Testing:** Thoroughly test your changes before submitting a pull request.

### Coding Style

*   Follow PEP 8 for Python code.
*   Use consistent formatting and indentation in your JavaScript code.
*   Write clear and concise commit messages.

### Pull Requests

1. **Create a Branch:** Create a new branch for your feature or bug fix.
2. **Make Changes:** Implement your changes and test them thoroughly.
3. **Commit:** Commit your changes with clear and descriptive commit messages.
4. **Push:** Push your branch to your forked repository.
5. **Create a Pull Request:** Open a pull request from your branch to the `main` branch of the original TABit repository.
6. **Describe:** Provide a clear description of your changes in the pull request.
7. **Review:** Be responsive to any feedback or questions during the code review process.

## License

By contributing to TABit, you agree that your contributions will be licensed under the [MIT License](LICENSE) (you should include an actual LICENSE file in your repository).
