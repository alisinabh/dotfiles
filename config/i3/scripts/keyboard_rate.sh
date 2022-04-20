#!/bin/bash

function setRate() {
  xset r rate 300 50
  sleep 2
  setRate
}

setRate
