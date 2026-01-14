from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import RPi.GPIO as GPIO
import uvicorn
import json
import threading
import time
import os

app = FastAPI()
cmd = (
    'nohup ./mjpg/mjpg_streamer '
    '-i "./mjpg/input_uvc.so -d /dev/video0 -r 320x240 -f 20" '
    '-o "./mjpg/output_http.so -w ./mjpg/www" '
    '> /dev/null 2>&1 &'
)
os.system(cmd)

ENA = 7
IN1 = 11
IN2 = 13
IN3 = 15
IN4 = 16
ENB = 12

GPIO.setmode(GPIO.BOARD)
GPIO.setup([ENA, ENB, IN1, IN2, IN3, IN4], GPIO.OUT)

pwm_a = GPIO.PWM(ENA, 1000)
pwm_b = GPIO.PWM(ENB, 1000)
pwm_a.start(0)
pwm_b.start(0)

# Allow all origins (or restrict to specific ones)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # You can put a specific domain here instead of "*"
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def stop_all():
    pwm_a.ChangeDutyCycle(0)
    pwm_b.ChangeDutyCycle(0)
    GPIO.output([IN1, IN2, IN3, IN4], GPIO.LOW)

def drivetrain(direction=None, turning=None, speed=70):
    stop_all()  # Stops motors and cancels any ongoing ramp

    # Set GPIO pins based on direction/turning
    if direction == "forward":
        GPIO.output(IN1, GPIO.LOW)
        GPIO.output(IN2, GPIO.HIGH)
        GPIO.output(IN3, GPIO.LOW)
        GPIO.output(IN4, GPIO.HIGH)

    elif direction == "backward":
        GPIO.output(IN1, GPIO.HIGH)
        GPIO.output(IN2, GPIO.LOW)
        GPIO.output(IN3, GPIO.HIGH)
        GPIO.output(IN4, GPIO.LOW)

    elif turning == "right":
        GPIO.output(IN1, GPIO.LOW)
        GPIO.output(IN2, GPIO.HIGH)
        GPIO.output(IN3, GPIO.HIGH)
        GPIO.output(IN4, GPIO.LOW)

    elif turning == "left":
        GPIO.output(IN1, GPIO.HIGH)
        GPIO.output(IN2, GPIO.LOW)
        GPIO.output(IN3, GPIO.LOW)
        GPIO.output(IN4, GPIO.HIGH)

    pwm_a.ChangeDutyCycle(speed)
    pwm_b.ChangeDutyCycle(speed)


@app.post("/drive")
async def drive(request: Request):
    try:
        body = await request.body()
        data = json.loads(body.decode())

        direction = data.get("direction")
        turning = data.get("turning")
        speed = data.get("speed", 40)

        print(direction, turning, speed)
        # Rule 1: Both specified → error
        if direction and turning:
            stop_all()
            return JSONResponse(status_code=400, content={"error": "Only one of 'direction' or 'turning' can be set."})

        # Rule 2: Both missing/None → stop motors
        if not direction and not turning:
            stop_all()
            return {"status": "stopped", "message": "No direction or turning specified. Motors stopped."}

        # Rule 3: Validate values
        if direction not in [None, "forward", "backward"]:
            return JSONResponse(status_code=400, content={"error": "Invalid 'direction' value."})

        if turning not in [None, "left", "right"]:
            return JSONResponse(status_code=400, content={"error": "Invalid 'turning' value."})

        if not isinstance(speed, (int, float)) or not (0 <= speed <= 100):
            return JSONResponse(status_code=400, content={"error": "Speed must be a number between 0 and 100."})

        # Valid single input → run drivetrain
        drivetrain(direction=direction, turning=turning, speed=speed)
        return {"status": "success", "direction": direction, "turning": turning, "speed": speed}

    except Exception as e:
        stop_all()
        return JSONResponse(status_code=500, content={"error": str(e)})


if __name__ == "__main__":
    try:
        uvicorn.run(app, host="0.0.0.0", port=8000)
    except KeyboardInterrupt:
        stop_all()
        pwm_a.stop()
        pwm_b.stop()
        del pwm_a, pwm_b
        GPIO.cleanup()
        os.system("pkill mjpg_streamer")
