#!/bin/sh

CPU_PACK_TEMP=$(sensors -j | jq '."coretemp-isa-0000"."Package id 0"."temp1_input"')

if [ "$CPU_PACK_TEMP" -gt "70" ];
then
	echo "<span color='red'> $CPU_PACK_TEMP°</span>";
else
	echo "<span color='lightblue'> $CPU_PACK_TEMP°</span>";
fi;
