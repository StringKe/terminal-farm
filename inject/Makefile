CC = cc
CFLAGS = -shared -O2 -Wall -Wextra -arch arm64
TARGET = inject.dylib
SANDBOX = /Users/chen/Library/Containers/com.tencent.qqexminiprogram/Data

.PHONY: all clean deploy

all: $(TARGET)

$(TARGET): inject.c
	$(CC) $(CFLAGS) -o $@ $<
	codesign -s - -f $@

deploy: $(TARGET)
	cp $(TARGET) $(SANDBOX)/inject.dylib
	codesign -s - -f $(SANDBOX)/inject.dylib
	cp ../scripts/rpc_server.js $(SANDBOX)/rpc_server.js
	@echo "deployed to $(SANDBOX)"

clean:
	rm -f $(TARGET)
