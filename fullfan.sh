#!/bin/bash

for i in {1..20}
do
    echo "Setting fan state to 4 (Run #$i)"
    echo 4 | sudo tee /sys/class/thermal/cooling_device0/cur_state > /dev/null
    sleep 0.7
done
