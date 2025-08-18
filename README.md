# Python Tweek — Simple Twilio Video Test Client

This is a simple test harness that uses the Twilio Video JS SDK on the client side to capture audio and video tracks.  
It sends chunked media data to a Python backend (FastAPI) for further handling.  
The backend can also forward snapshots of video frames to AWS Rekognition for analysis.

## Getting Started

### Pre-requisites

- Python version 3.13.3 or later
- venv and pip installed

### Clone and set up the project

git clone git@github.com:pheathtwilio/python-tweek.git
cd python-tweek

python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

### Run the Server

uvicorn server:app --reload --host 0.0.0.0 --port 8000

### Access the Client

You will see the test client UI at http://localhost:8000/ where you can start and stop the camera, stream chunks to the backend, and optionally receive analysis results over WebSocket.

## The Rekognition API

The AWS Rekognition API is an API that can detect facial emotions and other objects within either a snapshot(.jpg) or a live video stream using Rekognition Video. 

To get the correct tokens for this project, login to AWS and navigate to the IAM center and create a user with a name like ‘rekogntion-user’. Once the user is created, navigate to the Permissions tab and click Add permission > Create inline policy in the Permission policies section. Select Rekognition under the Service dropdown and select the All Rekognition actions box to enable full access to the Rekognition service. In the Resources section, select All to enable your permission to all your resource ARNs. Finally, click Next, enter your policy name and the click Create policy. Once you have done this, then you can create an access key and secret which you should note down for adding to your environment. You can create this by clicking Create access key in the user details section.

Update the .env file with these details:

AWS_ACCESS_KEY_ID=<your_access_key_id>
AWS_SECRET_ACCESS_KEY=<your_access_key_secret>
AWS_REGION=us-east-1 


## Notes
- The frontend is served from /static/index.html
- Audio and video is captured with the Twilio Video JS SDK but not sent to a Twilio Room — only local tracks are used
- Media chunks are posted to the FastAPI server at /upload/audio and /upload/video
- A WebSocket connection (/ws) allows the server to send messages back to the client in real time