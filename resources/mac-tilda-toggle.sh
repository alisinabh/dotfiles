#!/bin/zsh

mapping_set=$(hidutil property --get "UserKeyMapping" | wc -l)

echo $mapping_set

if [ $mapping_set -lt "4" ]; then
  echo "Remapping tilda"
  hidutil property --set '{"UserKeyMapping": [{"HIDKeyboardModifierMappingSrc": 0x700000064, "HIDKeyboardModifierMappingDst": 0x700000035}, {"HIDKeyboardModifierMappingSrc": 0x700000035, "HIDKeyboardModifierMappingDst": 0x700000064}]}'
else
  echo "Resetting tilda"
  hidutil property --set '{"UserKeyMapping": []}'
fi
