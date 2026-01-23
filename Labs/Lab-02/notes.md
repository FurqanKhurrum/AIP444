# Week 3

**Note:** Week 3 Sessions are not recorded

## Introduction

We will look at programming concepts and file I/O. In Linux, everything is a file, so it is important to know how to use them. We will also look at IOCTLs which are user-space calls into the Linux kernel. We also will look at the gdb debugger.

## Videos

### File I/O
- Linux file input/output
- open() vs fopen()

### IOCTLs
- Linux IOCTL's

### Debugging
- gdb And How To Debug C And C++ Code

## Quiz

Check syllabus/addendum schedule.

Study material on File I/O. Study **Chapter 4 (System Programming Concepts)** of *The Linux Programming Interface*.

## Lecture Material

- File I/O and IOCTLs - Chapter 4 of *The Linux Programming Interface*
- Controlling Hardware with ioctls

## Labs

- **Lab 2** - Using a static library
- **Lab 3** - I/O control

## Assignment(s)

None.

## Sample Code

### File I/O

- For an example of a program that simply copies a file from one location to another, see `SimpleFile.cpp`.
- For an example of a program that does exactly the same thing but uses `lseek` to start 100 bytes into the input file, see `SeekFile.cpp`.
- For a simple makefile to create these, see `Makefile`.
- The C library function `fopen` is compared with the Linux system function `open` via two test files - `openTest.cpp` and `fopenTest.cpp`. They both copy large amounts of data (`LargeOpen.txt` and `LargeFOpen.txt`) and the time to copy is measured as a function of `open`'s buffer size. For the makefile see `Makefile`.

### IOCTLs

- For an introduction to IOCTL's see *Controlling Hardware with ioctls*.
- For sample code using IOCTL's see `diskDrive.cpp`. This performs IOCTL's on the device driver for two file systems to get sector size, number of head, cylinders etc... Documentation on how to use this IOCTL can be found at *Summary of HDIO_ IOCTL calls* and *sd - driver for SCSI disk drives*.

### GDB - A Linux Debugger

We looked briefly at the Linux debugger GDB. A tutorial on GDB can be found at:
- [Debugging Under Unix: gdb Tutorial](https://example.com)
- [Red Hat Customer Portal: Chapter 20. Debugging a Running Application](https://example.com)

Source code that was used to demo GDB can be found at: `Makefile`, `Math.cpp`, `Math.h`, `Conversions.cpp`, `Conversions.h`, `General.cpp`, `General.h`, `Geometry.cpp`, `Geometry.h`.

In this source code the function `CelsiusToFahrenheit` was made to crash when the flag `CRASH` was enabled in the `Makefile`.

**To run a program with the gdb debugger**, for example `Math`, execute the following from the command line:
```bash
$ gdb ./Math
```

Then run the program from the gdb console:
```bash
(gdb) run
```

If the program crashes, you can execute the `backtrace` command from within the gdb console to see the flow of function calls that led to the crash:
```bash
(gdb) bt
```

**To attach gdb to an already existing process**, first get the process id then execute `gdb attach`. For instance, say `Math` is already running and has pid 5467:
```bash
$ gdb attach 5467
```

**Valgrind** is also available on Linux for testing whether your program has a memory leak. You can install valgrind as follows:
```bash
$ sudo apt install valgrind
```