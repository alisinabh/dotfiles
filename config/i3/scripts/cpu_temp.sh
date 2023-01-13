#!/bin/sh

CPU_PACK_TEMP=$(sensors -j | jq '."coretemp-isa-0000"."Core 0"."temp2_input"')

if [ "$CPU_PACK_TEMP" -gt "79" ];
then
	echo "<span color='red'> $CPU_PACK_TEMP°</span>";
else
	echo "<span color='lightblue'> $CPU_PACK_TEMP°</span>";
fi;
