import os, sys
sys.path.insert(0, os.getcwd())
from dotenv import load_dotenv
load_dotenv('.env')
from app.core.security import create_access_token
print(create_access_token(subject=sys.argv[1], extra_claims={'ver': int(sys.argv[2])}))
