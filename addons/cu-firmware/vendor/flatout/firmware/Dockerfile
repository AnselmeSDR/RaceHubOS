# Pinned compiler of the original firmware: avr-gcc 5.4.0 + Atmel patches 3.6.0.
#   docker build -t avr-gcc-5.4 firmware   (firmware/build.py does it on first use)
FROM ubuntu:18.04
RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      gcc-avr=1:5.4.0+Atmel3.6.0-1build1 binutils-avr avr-libc python3 \
 && rm -rf /var/lib/apt/lists/*
ENV LANG=C.UTF-8 PYTHONIOENCODING=utf-8
WORKDIR /fw
