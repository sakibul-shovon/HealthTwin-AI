import sys
modules_to_test = [
    "fastapi",
    "app.config",
    "app.graph.database",
    "app.api.household",
    "app.api.safety_test",
    "app.api.voice",
    "app.api.care",
    "app.api.chat",
    "app.api.emergency",
    "app.api.member",
    "app.api.upload",
    "app.api.reports",
    "app.api.insights",
]

for m in modules_to_test:
    print(f"Importing {m}...")
    try:
        __import__(m)
        print(f"Success {m}")
    except Exception as e:
        print(f"Error {m}: {e}")

print("Done")
