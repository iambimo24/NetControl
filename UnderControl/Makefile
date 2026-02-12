CC = g++
PKG = $(shell pkg-config --cflags --libs libdatachannel opencv4 nlohmann_json)
CXXFLAGS = -std=c++17 -O2 $(PKG)
LDFLAGS = 

SRCS = main.cpp
OUT = undercontrol

all: $(OUT)

$(OUT): $(SRCS)
	$(CC) $(CXXFLAGS) -o $@ $^

clean:
	rm -f $(OUT)

.PHONY: all clean
