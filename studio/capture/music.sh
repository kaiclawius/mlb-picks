#!/usr/bin/env sh
# Makes a quiet ambient music bed (synthesised, no licence needed): four slow swelling chords.
#   sh capture/music.sh public/<product>/music.m4a [seconds]
# For a real launch, swap it for a licensed track with the same file name.
out=${1:?output file}; d=${2:-60}
voice() { # $1 = detune factor
  echo "(0.22*sin(2*PI*ld(1)*$1*t)+0.14*sin(2*PI*ld(1)*1.5*$1*t)+0.12*sin(2*PI*ld(1)*2*t)+0.07*sin(2*PI*ld(1)*2.52*t)+0.12*sin(2*PI*ld(1)*0.5*t))*ld(2)"
}
expr="st(0,mod(floor(t/7.5),4));st(1,if(eq(ld(0),0),220,if(eq(ld(0),1),174.61,if(eq(ld(0),2),261.63,196))));st(2,pow(sin(PI*mod(t,7.5)/7.5),2));$(voice 1)|$(voice 1.003)"
ffmpeg -loglevel error -y -f lavfi -i "aevalsrc='$expr':s=44100:d=$d" \
  -af "lowpass=f=1600,aecho=0.8:0.75:180|360:0.4|0.3,afade=t=in:d=2,afade=t=out:st=$((d-4)):d=4,loudnorm=I=-24" \
  -c:a aac -b:a 160k "$out"
