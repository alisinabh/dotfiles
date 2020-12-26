#!/bin/bash

for VAR in 1 2 3
do
	echo 1 | tee /sys/class/leds/input8::capslock/brightness > /dev/null
	echo 1 | tee /sys/class/leds/input8::scrolllock/brightness > /dev/null
	sleep 0.2
	echo 0 | tee /sys/class/leds/input8::capslock/brightness > /dev/null
	echo 0 | tee /sys/class/leds/input8::scrolllock/brightness > /dev/null
	sleep 0.2
done
