import sys
print("Starting script...")
try:
    from app.main import app
    print("Imported app successfully!")
except Exception as e:
    print(f"Error importing app: {e}")
    sys.exit(1)

import uvicorn
print("Starting uvicorn...")
uvicorn.run(app, host="127.0.0.1", port=8000)
