CC = cc
CFLAGS = -shared -O2 -Wall -Wextra -arch arm64
TARGET = inject.dylib

.PHONY: all clean

all: $(TARGET)

$(TARGET): inject.c
	$(CC) $(CFLAGS) -o $@ $<

clean:
	rm -f $(TARGET)
