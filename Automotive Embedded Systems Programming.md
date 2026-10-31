  
## [1주차] 임베디드 시스템 개요, Cortex-M7 아키텍처 및 UART 통신 이론

### 1. 핵심 개념 및 이론적 배경

#### 1) 임베디드 시스템의 정의 및 4대 본질적 특성
* **정의**: 특정 기계나 제품 내부에 내장(Embedded)되어 사전에 정의된 특정 기능만을 전담 수행하는 컴퓨터 시스템.
	* 실행되는 기계가 아닌, 다른 기계에서 개발
	* 범용 컴퓨터(PC) : 사용자가 임의의 프로그램을 설치해 실행 
	* 임베디드 시스템 : 정해진 입력을 읽고 정해진 출력을 제어하는 전용 컴퓨터
* **4대 특성**:
	  1. **자원 제약 (Resource Constrained)**: 
		  * PC 대비 엄격히 제한된 CPU 연산 성능, 소용량 메모리(Flash, SRAM), 소비 전력 예산 내에서 동작해야 함.
	  2. **실시간성 (Real-Time Property)**: 
		  * 연산 결과의 논리적 정확성뿐만 아니라 사전에 정의된 마감 시간(Deadline)을 반드시 엄수해야 함 (예: 차량 에어백 전개 제어는 수 ms 이내에 완료되어야 함).
	  3. **전용성 (Dedicated Purpose)**: 
		  * 범용 연산이 아닌 해당 하드웨어 목적에 특화된 HW/SW 구성을 취함 (예: 세탁기 제어기는 오직 세탁 시퀀스만을 제어).
	  4. **하드웨어 의존성 (Hardware Dependency)**: 
		  * 타깃 MCU의 핀, 클럭, 레지스터를 직접 제어, 핀 설정 오류 시 하드웨어 구동이 전면 중단됨.
* **차량용 ECU의 특수성**: 
	* 일반적인 차량에는 엔진 제어, ABS, 조향, 배터리 관리(BMS) 등을 위해 수십~100개 이상의 전자 제어 장치(ECU)가 탑재됨.
* **PC 프로그램 vs MCU 프로그램**: 
	* PC : 실행 파일을 OS 위에서 바로 실행
	* MCU : ELF를 보드의 Flash에 다운로드한 뒤 실행
	* 소스 코드 -> 컴파일/링크 -> ELF -> OpenSDA / PEmicro -> MCU Flash -> 실행
		(작성한 C 코드가 실제 보드에서 돌아가기 까지 거치는 5단계 절차)
#### 2) 범용 MCU와 차량용 MCU의 차이: "안전 메커니즘"
* **ASIL (Automotive Safety Integrity Level)**: 
	* ISO 26262 국제 표준에서 정의하는 차량 기능 안전성 무결성 등급
	* ASIL-A(낮음)부터 ASIL-D(가장 엄격 결함 허용률 / 제동, 조향 등 인명 피해 큰 기능)까지 분류됨.
* **S32K3 칩셋의 하드웨어 고장 검출 메커니즘**:
	* **메모리 ECC (Error Correcting Code)**: 메모리(SRAM, Flash) 데이터 비트 오류를 실시간 검출 및 1비트 에러 자동 정정.
	* **Lockstep 아키텍처**: 독립된 두 개의 코어가 동일한 명령어를 동시에 병렬 실행한 후, 클럭 사이클 단위로 연산 결과를 상호 대조하여 하드웨어 결함을 실시간 검출함.
	* **전압, 온도, 클럭 감시 하드웨어 회로** 내장.

#### 3) Cortex-M7 프로세서 코어 내부 구조
* **CPU 특성**: 
	* S32K312의 연산을 담당
	* ARMv7-M 아키텍처 기반의 32비트 고성능 MCU 코어
	* OS 없이 부팅 가능. 빠른 인터럽트 반응성을 제공함.
	* Thumb-2 명령어 집합
		* 16비트/32비트 명령어 혼용
		* 코드 밀도와 연산 성능의 균형 확보
* **코어 레지스터 구성**:
  * `R0 ~ R12`: 범용 연산 레지스터 및 함수 인자 / 임시 데이터 저장.
  * `R13 (SP, Stack Pointer)`: 
	  스택 메모리 최상단을 가리키며, **MSP(Main Stack Pointer)** 와 **PSP(Process Stack Pointer)** 로 나뉨
	    * *MSP*: 리셋 직후와 예외(Exception) / 인터럽트 처리에서 사용
	    * *PSP*: RTOS(FreeRTOS 등) 환경에서 각 태스크별 스택 분리에 사용
  * `R14 (LR, Link Register)`:  함수 호출 후 복귀할 명령어 주소를 저장
  * `R15 (PC, Program Counter)`: 다음 실행할 명령어의 메모리 주소를 가리킴
  * `xPSR (Program Status Register)`: 조건 플래그와 예외 상태 정보 보관
* **예외 처리 및 벡터 테이블(Vector Table)**:
  * 모든 하드웨어 이벤트를 예외(Exception)로 통합 관리.
	  * 외부 핀 변화, 타이머 만료, UART 수신 등
  * NVIC (Nested Vectored Interrupt Controller)가 관리 
	* 인터럽트 enable, pending 상태, 우선순위, 중첩 처리
  * **벡터 테이블  :
	  * 예외별 핸들러 주소를 담은 배열
	    * *0번 항목*: 초기 스택 포인터 값 (Initial MSP).
	    * *1번 항목*: 초기 진입 함수인 Reset Handler 주소.
*  **리셋 흐름** :
$$\text{Reset} \longrightarrow \text{Vector Table} \longrightarrow \text{Reset Handler} \longrightarrow \text{Runtime init} \longrightarrow \text{main()}$$
* **시스템 부팅 흐름**:
$$\text{Power-On Reset} \longrightarrow \text{BAF (Boot Assist Flash)} \longrightarrow \text{IVT (Image Vector Table) 확인} \longrightarrow \text{사용자 벡터 테이블} \longrightarrow \text{startup}\longrightarrow \text{main()}$$
* BAF (Boot Assist Flash): 부팅을 돕는 NXP 내장 코드
* IVT (Image Vector Table): 부팅 이미지와 사용자 코드 진입 정보

#### 4) 메모리 맵 및 Memory-Mapped I/O 원리
* **메모리 영역 구분**:
  * *Code Flash*: 실행 코드 및 읽기 전용 데이터(RO Data).
  * *Data Flash*: 전원 차단 후에도 유지할 설정값 (+ 시스템 파라미터).
  * *SRAM*: 전역 변수, 지역 변수 스택, 런타임 데이터
  * *TCM (Tightly Coupled Memory)*: 빠르고 지연이 예측 가능한 코드 / 데이터
  * *Peripheral*: UART, GPIO, CAN 등의 제어 레지스터
* **Memory-Mapped I/O**:
  * 같은 C 문장이라도 주소 영역에 따라 의미가 달라짐
  * C 언어 문법상 `*ptr = value;`를 수행할 때, 
	  * 해당 `ptr`이 SRAM 영역이면 단순 데이터 변수 저장에 그치지만, 
	  * Peripheral 영역 주소일 경우 핀 전압 변경, 송수신, 인터럽트 상태 등 물리 하드웨어의 상태가 즉각적으로 바뀜.
#### 5) 클럭 트리(Clock Tree) 구조
$$\text{FIRC / SIRC / FXOSC} \longrightarrow \text{PLL} \longrightarrow \text{System / Bus / Peripheral Clock}$$
* FIRC : 내부 고속 RC 발진기
* SIRC : 내부 저속 저전력 RC 발진기
* FXOSC : 외부 정밀 크리스털 발진기
* PLL (Phase-Locked Loop): 기본 입력 클럭을 체배(증폭)하여 고속 시스템 클럭을 생성.
* CPU, 버스, UART 등 모든 주변장치는 클럭을 기준으로 동작
* S32K312의 기준 Cortex-M7 코어 클럭 주파수는 **120 MHz (120,000,000 Hz)** 로 설정됨.
#### 6) AUTOSAR와 RTD 명명 규칙
* **AUTOSAR (AUTomotive Open System ARchitecture)** : 
	* 차량 소프트웨어 표준 아키텍처. RTD(Real Time Driver, AUTOSAR 기반 주변장치 드라이버)는 이 표준을 따름
	* RTD 함수는 모듈_기능 규칙을 따른다 ex) Lpuart_Uart_Ip_SyncSend()
	* 모듈·기능·드라이버 계층을 구분해 설정과 코드를 관리하기 위한 구조
#### 7) UART 통신 프로토콜 및 `printf()` 리다이렉션 이론
* **UART (Universal Asynchronous Receiver/Transmitter)**: 
	* 가장 기본적인 비동기 방식
	* 별도의 클럭 선 없이 TX(송신), RX(수신) 2가닥 선을 통해 양방향 데이터를 전송
	* 송수신 양쪽이 같은 보율(Baud Rate)을 사용해야 함.
* **UART 데이터 프레임 구조 (8-N-1 표준 기준)**:
	**전송 순서 요약**: `[Idle: HIGH]` ➔ `[Start: LOW]` ➔ `[D0(LSB) ~ D7(MSB)]` ➔ `[Parity: 선택]` ➔ `[Stop: HIGH]` ➔ `[Idle: HIGH]`
  1. *Idle 상태*: 전송 데이터가 없을 때 라인은 `HIGH` 유지.
  2. *Start Bit*: 라인을 `LOW`로 떨어뜨려 프레임의 시작을 알림.
  3. *Data Bits*: 8비트의 데이터 바이트를 **LSB(최하위 비트)부터 MSB(최상위 비트)** 순서로 직렬 전송.
  4. *Parity Bit*: 단순 오류 검출용 선택 비트
  5. *Stop Bit*: 라인를 `HIGH`로 복귀시켜 프레임 끝을 알림.
*  **OpenSDA VCOM 경로** :
	* OpenSDA 디버거는 가상 COM 포트(VCOM) 기능을 겸한다
	*  USB 케이블 하나로 디버깅과 시리얼 통신을 함께 처리
	**신호 전달 흐름**: 
		`S32K312 (LPUART6)` ➔ `OpenSDA 칩 (VCOM 변환)` ➔ `USB 케이블` ➔ `PC 시리얼 터미널(PuTTY)`
* **`printf()` 리다이렉션 원리**:
  * `printf()` 최종적으로 `_write()` 같은 저수준 출력 함수를 호출
  *  PC에서는 콘솔이나 파일로 연결되지만, MCU에는 기본 화면 X
  *  `_write()`를 직접 구현해 출력 바이트를 LPUART로 보냄 (retargeting)
  ```
  int _write(int file, char *ptr, int len) { 
  	  /* ptr의 len 바이트를 LPUART로 송신 */ 
  }
  ```

* **`printf()` 출력 경로** :
	 `printf()` ➔ `_write()` ➔ `Lpuart_Uart_Ip_SyncSend()` ➔ `S32K312 LPUART6 TX (PTA16)` ➔ `OpenSDA VCOM` ➔ `USB` ➔ `PC 시리얼 터미널`

### 2. 주차별 실습 진행 요약 (어떻게 수행했는가)
* **목표**: LPUART6 채널을 활성화하고 `printf()`를 리다이렉션하여 PC 시리얼 터미널(PuTTY/Tera Term)로 문자열을 출력하는 디버깅 채널 구축.
* **하드웨어 매핑**: 보드 내장 OpenSDA VCOM과 직결된 `PTA16`을 `LPUART6_TX`, `PTA15`를 `LPUART6_RX`로 설정.
* **설정 절차**: S32DS Config Tools에서 Clock_Ip(LPUART6_CLK 30MHz 활성화), Siul2_Port_Ip(핀 Mux 및 방향 설정), Lpuart_Uart_Ip(115200 bps, 8N1 설정)를 추가하고 코드를 자동 생성.
* **코드 구현**: `main.c`에 `_write()` 함수를 구현하여 `Lpuart_Uart_Ip_SyncSend()`를 호출하도록 작성하고, `Clock_Ip_Init()`, `Siul2_Port_Ip_Init()`, `Lpuart_Uart_Ip_Init()` 순으로 하드웨어를 활성화한 뒤 `printf("Hello S32K3, %s %s\r\n", ...)`를 호출하여 PC 화면으로 출력을 확인.

---

## [2주차] GPIO 하드웨어 주소 직접 접근하기 (Memory-Mapped I/O와 SIUL2 레지스터)

### 1. 핵심 개념 및 이론적 배경

#### 1) Memory-Mapped I/O와 일반 RAM 접근의 차이
* RAM, Flash, 주변장치(Peripheral) 제어 레지스터가 하나의 주소 공간에 배치
* CPU는 같은 load/store 명령으로 변수와 하드웨어를 모두 다룸
* **CPU `load`/`store` 명령어의 목적지 주소에 따른 분기** :
    * `SRAM 주소`: 변수 읽기/쓰기
    * `Flash 주소`: 코드 / 상수 읽기
    * `Peripheral 주소`: 하드웨어 레지스터
* **"같은 문장, 다른 결과" (`*ptr = 1U;`)**:
  * `ptr`이 SRAM 주소를 가리키면: C 프로그램 변수 값이 변경됨.
  * `ptr`이 GPIO 출력 레지스터를 가리키면: 실제 물리 핀의 전압 레벨(High/Low)이 변경됨.

#### 2) `volatile` 키워드의 필수성 및 컴파일러 최적화 방지 원리
* **문제 배경**: C 컴파일러는 코드의 논리적 의미가 변하지 않는다고 판단하면 메모리 접근 명령어를 임의로 제거(Elimination)하거나 순서를 재배치(Reordering)함.
  * 예시 코드:
    ```c
    while (STATUS_REG == 0U) { /* 대기 */ }
    ```
  * `STATUS_REG`가 일반 메모리 변수로 선언되어 있다면, 루프 내부에서 해당 변수를 수정하는 문장이 없으므로 컴파일러는 최초 1회만 레지스터에 값을 읽어 캐싱한 뒤 무한 루프를 돌거나 루프 자체를 왜곡함.
  * 그러나 `STATUS_REG`가 하드웨어 레지스터라면, CPU 외부 회로 및 주변장치 하드웨어 동작에 의해 값이 실시간으로 변경될 수 있음.
* **`volatile`의 선언 의미**:
  * "이 메모리 주소에 대한 접근은 매번 실제로 수행하고, 최적화 과정에서 생략하거나 순서를 바꾸지 말라"고 컴파일러에 강제 지시함.
  * 레지스터 포인터 선언 표준 문법:
    ```c
    #define STATUS_REG (*(volatile uint32_t *) 0x40000000UL)
    ```
  * GPIO 출력 레지스터 쓰기에서도 `volatile`이 누락될 경우, LED를 켜고 끄는 명령이 무의미한 연속 쓰기로 간주되어 코드가 삭제될 수 있으며, 지연 함수(`Delay`) 루프 또한 통째로 날아가 점멸 동작이 멈추게 됨.

#### 3) 비트 마스킹(Bit Masking) 4대 기본 패턴
주변장치 제어 레지스터는 32비트(1개 워드) 내에 여러 개의 제어 필드가 밀집되어 있으므로 다른 필드를 건드리지 않고 원하는 비트만 조작하기 위해 비트 마스크 연산이 필수적임.
1. **비트 Set (n번 비트를 1로 설정)**:
   $$reg\ \text{\vert{}}=\ (1\text{U} \ll n);$$
2. **비트 Clear (n번 비트를 0으로 설정)**:
   $$reg\ \&=\ \sim(1\text{U} \ll n);$$
3. **비트 Toggle (n번 비트 상태 반전)**:
   $$reg\ \text{\textasciicircum}=\ (1\text{U} \ll n);$$
4. **필드 변경 (Read-Modify-Write: 특정 비트 필드를 지우고 새 값 대입)**:
   $$reg = (reg\ \&\ \sim mask)\ \vert{}\ value;$$
* **GPIO 출력으로 만들기** :
	* 주변장치 레지스터는 여러 제어 비트를 한 워드에 담는다
		* 특정 비트만 바꾸려면 마스크를 사용한다
	* S32K312에서는 GPIO 핀을 출력으로 만들기 위해
		* MSCR의 출력 버퍼 enable 비트를 set
		* 핀 기능 선택 필드를 GPIO 기능으로 설정
#### 4) S32K3 SIUL2 (System Integration Unit Lite2) 블록 구조와 핵심 레지스터
* **SIUL2** : 핀 기능, GPIO 입출력 담당 (+ 핀 다중화, 입력 신호 라우팅, 출력 드라이버 설정)
* **주요 레지스터**
	* **MSCR[n] (Multiplexed Signal Configuration Register)**:
		* 핀 속성, 출력/입력 enable, mux / 핀기능, 입출력 버퍼, 전기적 속성 설정
	* **IMCR[n] (Input Multiplexed Signal Configuration Register)**:
		* 주변장치 입력 신호의 Pad를 선택
	* **GPDO[n] (GPIO Pad Data Output)**:
		* GPIO 출력 값 쓰기
	* **GPDI[n] (GPIO Pad Data Input)**:
		* GPIO 입력 값 읽기

`[GPIO]` ────┐ 
`[UART]` ────┼──► `[ Mux (MSCR) ]` ──► `[ 패드 ]` 
`[eMIOS]` ───┘
	* **방향**: 내부 주변장치 ➔ 외부 핀 (Output) 
	* **역할**: 패드 1개에 어떤 내부 기능(GPIO, UART TX, eMIOS 등)의 신호를 내보낼지 선택.

`[ 외부 패드 1 ]` ───┐ 
`[ 외부 패드 2 ]` ───┼──► `[ Mux (IMCR) ]` ──► `[ EIRQ (내부 인터럽트) ]`
`[ 외부 패드 3 ]` ───┘
	* **방향**: 외부 핀 ➔ 내부 주변장치 (Input) 
	* **역할**: 특정 내부 입력 기능(EIRQ, UART RX 등)을 어떤 물리 패드에서 입력받을지 선택.

* **PGPDO[n] / PGPDI[n] (Parallel GPIO Pad Data Output / Input)**:
	* 여러 GPIO 출력을 병렬로 쓰기 / 읽기.

#### 5) MSCR 레지스터 내부 비트 구조와 GPIO 출력 설정 원리
* MSCR: pad별 설정 레지스터
* MSCR 레지스터에서 특정 핀을 GPIO 출력 모드로 만들기 위해 반드시 조작해야 하는 핵심 필드
* **OBE (Output Buffer Enable)**
* **SSS (Source Signal Select)** : `0000b (0)` = GPIO 기능 선택
* **GPIO 출력 설정 처리 흐름 (Read-Modify-Write)**:
$$\text{MSCR 읽기} \longrightarrow \text{SSS를 GPIO로} \longrightarrow \text{OBE Set} \longrightarrow \text{MSCR에 다시 쓰기}$$
#### 6) SIUL2 하드웨어 물리 주소와 치명적인 "GPDO 역순 배치" 규격
* **SIUL2 기준 베이스 주소**:
  * `SIUL2_BASE_ADDR`: **`0x40290000UL`**
  * `SIUL2_MSCR_OFFSET`: **`0x0240UL`** (32비트 단위 배열)
  * `SIUL2_GPDO_OFFSET`: **`0x1300UL`** (8비트 바이트 단위 배열)
* **MSCR 물리 주소 계산 수식**:
  * MSCR은 32비트(4바이트) 레지스터 배열이므로 주소 계산이 단순
  * 인덱스 `n`에 대해 정방향 4바이트 단위로 증가함:
$$\text{MSCR}[n]\ \text{Address} = \text{0x40290000} + \text{0x0240} + (4 \times n)$$

 **[주의: 시험 및 개발 핵심] 
##### GPDO 4바이트 단위 역순 배치 (Reversed Byte Packing)**:
  * S32K312의 GPDO 바이트 레지스터는 **4개 단위(Word 단위)로 역순 배치(Big-Endian style byte swapping inside Little-Endian word)** 되어 있음.
  * 실제 하드웨어 오프셋 맵:
    * `0x1300`: **GPDO3**
    * `0x1301`: **GPDO2**
    * `0x1302`: **GPDO1**
    * `0x1303`: **GPDO0**
    * ...
    * `0x131C`: **GPDO31**
    * `0x131D`: **GPDO30**
    * `0x131E`: **GPDO29**
    * `0x131F`: **GPDO28**
  * GPDO 바이트 오프셋 계산 매크로 수식:
    ```c
    #define SIUL2_GPDO_BYTE_OFFSET(index) \
    (SIUL2_GPDO_OFFSET+(((uint32_t)(index)&~3UL)+(3UL-((uint32_t)(index)&3UL))))
    ```
    **GPIO[29] 대입 시** : $(29\ \&\ \sim 3) + (3 - (29\ \&\ 3)) = 28 + (3 - 1) = 28 + 2 = 30\ (\text{0x1E})$.  
    따라서 최종 오프셋은 $\text{0x1300} + \text{0x1E} = \mathbf{0x131E}$가 됨.

#### 7) MSCR 번호 ≠ GPIO 번호 구분 및 하드웨어 문서 탐색 순서
* **주의**: 두 값은 물리적으로 전혀 다른 레지스터의 인덱스이므로 한 변수로 취급해서는 안 됨.
* **임베디드 하드웨어 분석 3단계 순서**:
  1. `보드 매뉴얼 (HWUM)`: 어떤 LED/스위치가 어떤 MCU 핀에 연결됐는가
  2. `IOMUX 표`: 그 핀의 MSCR 번호, GPIO 번호, ALT 기능
  3. `RTD 헤더 / Reference Manual`: 레지스터 주소, 필드, 구조체 이름
#### 8) Active High vs Active Low 구동 논리
* **Active High LED**: GPIO 출력에 `1` (High 전압)을 쓰면 점등(On), `0` (Low 전압)을 쓰면 소등(Off).
* **Active Low LED** : 반대로 `0`을 쓸 때 LED가 켜지고, `1`을 쓸 때 꺼지는 회로 방식.
#### 9) 직접 주소 접근 방식 vs SDK 헤더 활용 방식 비교
* **직접 주소 접근 방식**: 주소를 직접 계산 후 volatile 포인터로 역참조
  ```c
  #define SIUL2_MSCR(index) (*(volatile uint32_t *)(SIUL2_BASE_ADDR + SIUL2_MSCR_OFFSET + (4UL * (index))))
  ```
* **SDK 헤더 활용 방식**: 구조체 필드 이름을 사용한다
  ```c
  IP_SIUL2->MSCR[29] = value;
  IP_SIUL2->GPDO29 = 1U;
  ```

| 비교 항목 | 직접 주소 매크로 | SDK 헤더 활용 |
| :--- | :--- | :--- |
| **주소 계산 이해** | 높음 | 낮음 |
| **코드 가독성** | 낮음 | 높음 |
| **오타 위험** | 높음 | 낮음 |
| **이식성** | 낮음 | 높음 |
| **실습 목적** | 레지스터 구조 이해 | 실무형 접근 이해 |

#### 10) 2주차 클럭 게이팅(Clock Gating) 처리 원칙
* 주변장치는 해당 모듈의 클럭이 공급될 때만 동작
### 2. 주차별 실습 진행 요약 (어떻게 수행했는가)

* **실습 목표**: Config Tools(GUI 도구)를 일절 사용하지 않고, 오직 C 언어 코드만으로 S32K312EVB 보드의 D13(PTA29) 빨간색 LED를 점멸시킴.
  * 1단계: 하드웨어 주소 연산 및 매크로를 이용한 레지스터 직접 제어.
  * 2단계: NXP SDK 헤더(`IP_SIUL2`) 구조체 방식으로 전환하여 동일 동작 검증 및 코드 비교.
* **하드웨어 사양**:
  * Target: S32K312 / S32K312EVB-Q172
  * LED: D13 / RGBLED0_RED / PTA29 / Active High
  * 사용 레지스터: `MSCR29`, `GPDO29` (Offset `0x131E`)
  * 도구: S32 Design Studio 3.6.7, GCC 10.2, PEmicro 12.7.0
* **실습 진행 단계**:
  1. **프로젝트 생성**: `File -> New -> S32DS Application Project`에서 디바이스 `S32K312`, Toolchain `GCC 10.2`를 선택하여 `chap02_gpio_bare` 프로젝트 생성 (SDK/RTD 미사용).
  2. **`gpio_bare.h` 헤더 파일 작성**:
     * `SIUL2_BASE_ADDR`(0x40290000), `SIUL2_MSCR_OFFSET`(0x0240), `SIUL2_GPDO_OFFSET`(0x1300) 선언.
     * GPDO 역순 바이트 계산 매크로 `SIUL2_GPDO_BYTE_OFFSET(index)` 구현.
     * `volatile` 역참조 매크로 `SIUL2_MSCR(index)` 및 `SIUL2_GPDO(index)` 작성.
     * OBE(비트 21), SSS(비트 3:0, GPIO=0) 마스크 정의 및 인라인 함수 `GpioBare_SetOutput()`, `GpioBare_Write()` 구현.
  3. **`main.c` 소스 파일 작성**:
     * `#define USE_SDK_HEADER_ACCESS (0)` 상태에서 `LedInit()`(MSCR 출력 버퍼 켜기, SSS를 GPIO로 설정, 초기 상태 Off 쓰기) 및 `LedWrite()` 함수 작성.
     * `Delay(volatile uint32_t count)` 루프를 작성하여 무한 루프 내에서 LED를 400만 카운트 간격으로 켜고 끄는 로직 구현.
  4. **빌드, 다운로드 및 실행**:
     * `Project -> Build Project`를 통해 `0 errors` 및 `chap02_gpio_bare.elf` 생성 확인.
     * OpenSDA USB를 연결하고 Debug Configurations에서 `FLASH_PNE`를 선택하여 보드 내부 Flash에 다운로드 후 실행(Resume)하여 D13 Red LED 점멸 확인.
  5. **SDK 헤더 방식으로 전환 검증**:
     * `USE_SDK_HEADER_ACCESS` 매크로 값을 `(1)`로 변경.
     * `IP_SIUL2->MSCR[29]` 및 `IP_SIUL2->GPDO29` 구조체 필드를 사용하는 코드로 재빌드 및 다운로드하여 동일하게 LED가 정상 점멸함을 확인.

---

## [3주차] 소프트웨어 추상화 계층 비교 (IPL vs AUTOSAR MCAL)

### 1. 핵심 개념 및 이론적 배경

#### 1) 소프트웨어 추상화의 본질과 계층 피라미드, RTD
* **추상화** : 
	* 하드웨어를 숨기는 것이 아니라, 
	* 하드웨어 의존성을 어디에 모아둘지 결정하는 설계 기법
	* 하드웨어 의존성을 어느 계층에 둘 것인가
* **추상화 계층 구조 (NXP 아키텍처 기준)**:

| 계층 (Layer)            | 설명 및 구성 요소             |
| :-------------------- | :--------------------- |
| **Application**       | 응용 로직                  |
| **AUTOSAR BSW / RTE** | 서비스 · 통신 · OS          |
| **MCAL**              | Port / Dio / Adc / Can |
| **IPL**               | 벤더 Low-Level Driver    |
| **레지스터 / 베어메탈**       | SIUL2 MSCR / GPDO (2장) |

> **참고**: 일반적으로 말하는 **HAL(Hardware Abstraction Layer)** 은 위 구조에서 **IPL + MCAL**에 해당합니다.

* **NXP RTD** : 
	* HLD (High Level Driver) : MCAL용 인터페이스 함수
	* IPL (IP Level driver): 가장 낮은 레벨의 인터페이스 함수
	* 각 층은 아래 층을 함수 이름으로 감싼다 
		* 위 층이 하드웨어 세부를 모르고도 동작하게 한다
	* 대가로 코드가 늘고 빌드가 커짐

* **추상화의 이득**:

| 이득        | 의미                    | 사례                   |
| :-------- | :-------------------- | :------------------- |
| **이식성**   | 하드웨어가 바뀌어도 응용 코드는 그대로 | MCU 교체 시 드라이버만 교체    |
| **안전성**   | 표준 인터페이스로 검증·재사용      | 인증된 드라이버를 여러 차종에     |
| **검증 비용** | 한 번 검증한 계층을 재사용       | 레지스터 코드를 매번 재검증하지 않음 |

#### 2) IPL (IP Level Driver)의 특성
* 특정 하드웨어 IP(SIUL2, LPI2C 등)에 밀접하게 맞추어진 벤더 전용 저수준 드라이버.
* 직접 레지스터 접근 vs IPL 방식 
	* 직접 레지스터 접근 (C의 매크로 사용)
		* `SIUL2_GPDO(29U) = 1U`
	* IPL 호출 (C의 함수 사용)
		* `Siul2_Dio_Ip_WritePin(PTA_H_HALF, 13U, 1U);`
* IPL은 SIUL2의 GPIO 포트 half와 half 안의 핀 번호를 지정
* **IPL의 성격**:
	* 특정 IP의 이름과 자료형이 코드에 드러난다
	* 대신 레지스터 주소 계산과 접근 폭은 RTD 드라이버 안에 있다
	* 직접 만든 HAL보다 RTD의 구현·검증을 재사용할 수 있다
	* 그러나 다른 MCU/IP로 옮기면 호출 API 자체가 바뀔 수 있다
#### 3) AUTOSAR MCAL (Microcontroller Abstraction Layer) 아키텍처
* **정의**: 
	* AUTOSAR Classic Platform이 정의한 표준 추상화 계층
	* BSW(Basic Software)의 가장 아래에 있다
		* Port ·Dio ·Gpt ·Adc ·Can 등 표준 모듈로 구성
	* NXP RTD(Real-Time Drivers)가 바로 이 MCAL의 구현체
* **BSW의 계층** : (높)Services - ECU Abstraction Layer - Complex Driver - MCAL(낮)
* **핵심 설계 철학 - 설정과 코드의 엄격한 분리**: 
	* 핀 방향·기능 같은 설정은 코드에 직접 쓰지 않는다
	* Config Tools가 생성하는 초기화 구조체에 담는다
	* 응용코드 작업 : Port_Init()으로 그 구조체를 적용하고, Dio_WriteChannel()로 동작만 호출한다
* **차량 산업에서 MCAL을 채택하는 이유**: 
	* 차량 SW는 ASIL 등급 인증·검증 필수
	* 표준화된 MCAL을 쓰면 한 번 인증한 드라이버를 여러 차종·MCU에 재사용 가능
	* 도구·구조체·생성 단계의 번거로움 < 검증 비용 절감

#### 4) Port 드라이버와 Dio 드라이버
* **Port 드라이버 (하드웨어 정적 특성 초기화)**: 핀의 모드, 방향, 전기적 속성, 초기 상태 설정
* **Dio 드라이버 (런타임 동적 레벨 제어)**: 설정된 디지털 채널을 읽기, 쓰기, 토글
	* PTA29를 GPIO 출력으로 설정하는 일 → Port의 책임 
	* 그 채널에 STD_HIGH / STD_LOW를 쓰는 일 → Dio의 책임

*  **IPL과 MCAL의 차이**

| 비교 항목        | RTD IPL 방식                  | AUTOSAR MCAL 방식            |
| :----------- | :-------------------------- | :------------------------- |
| **API 출처**   | RTD의 SIUL2 IP driver        | RTD의 AUTOSAR MCAL driver   |
| **설정 위치**    | Pins 설정과 생성된 pin-mux 구조체    | Config Tools의 Port/Dio 설정  |
| **호출 단위**    | SIUL2 포트 half와 핀 번호         | AUTOSAR Dio channel ID     |
| **초기학습 비용 ** | 낮음 ~ 중간                     | 낮음 ~ 중간                    |
| **검증 단위**    | SIUL2 IP API와 pin-mux 생성 코드 | Port/Dio API, 설정 파일, 생성 코드 |
| **이식성**      | 같은 SIUL2 IP 계열 안에서 유리       | 지원 MCU/보드 범위 안에서 유리        |

### 2. 주차별 실습 진행 요약 (어떻게 수행했는가)
* **목표**: 동일한 하드웨어 동작(D13 LED 점멸)을 IPL과 MCAL 두 가지 상이한 아키텍처 프로젝트로 각각 구현하여 바이너리 크기와 소스 코드 의존성을 대조 분석.
* **IPL 실습 (`chap03_gpio_ipl`)**:
  * Pins Tool에서 PTA29를 출력으로 설정하고 생성된 `Siul2_Port_Ip_Init()`을 호출.
  * 포트 Half 계산법에 따라 상위 Half 매크로를 사용하여 `Siul2_Dio_Ip_WritePin(PTA_H_HALF, 13U, level)`로 LED를 제어.
* **MCAL 실습 (`chap03_gpio_mcal`)**:
  * Peripherals에서 Port 모듈(PTA29 출력 설정)과 Dio 모듈(Port 1, Channel 13을 심볼명 `RGBLED0_RED`로 매핑)을 구성.
  * `Port_Init(NULL_PTR)`로 정적 설정을 로드하고, 소스 코드에는 물리 핀 번호 대신 생성된 심볼 매크로를 인자로 넘겨 `Dio_WriteChannel(DioConf_DioChannel_RGBLEDO_RED, level)`로 구동.
  * 컴파일 후 빌드 콘솔의 `arm-none-eabi-size` 출력 결과를 통해 Flash 메모리를 차지하는 `.text` 섹션 크기를 비교 분석.

---

## [4주차] I2C 통신 프로토콜 및 캐릭터 LCD (HD44780 + PCF8574) 구동 이론

### 1. 핵심 개념 및 이론적 배경

#### 1) I2C (Inter-Integrated Circuit) 버스 통신 이론
* **신호선 구성**: SDA(데이터)와 SCL(클럭) 두 신호선으로 동작
* 여러 장치가 함께 연결되므로 각 장치는 고유한 주소를 가짐
* **오픈 드레인과 풀업:
  * I2C 신호선은 push-pull처럼 HIGH와 LOW를 모두 구동하지 않는다
	  * 대부분의 장치는 LOW만 끌어내림
	  * HIGH는 풀업 저항(보통 4.7 kΩ)에 맡김
  * SDA/SCL에는 풀업 저항이 필요

* **특성**:

| 특성          | 의미                        |
| :---------- | :------------------------ |
| **2선 + 풀업** | 배선 최소, 누구도 안 끌면 HIGH      |
| **오픈 드레인**  | 충돌 없이 여러 장치 공존            |
| **주소 기반**   | 7-bit 또는 10-bit 주소로 대상 지정 |
| **속도 모드**   | 100 kHz / 400 kHz / 1 MHz |
#### 2) I2C 프레임(Frame) 시퀀스 상세 규격
![[Pasted image 20261023015604.png]]
* **START** : SCL이 HIGH인 동안 SDA가 HIGH → LOW
* **데이터** **비트**: SCL이 LOW일 때 SDA가 바뀌고, SCL이 HIGH일 때 읽힌다 
* **ACK** : 수신 측이 9번째 클럭 동안 SDA를 LOW로 유지해야 함
* **STOP** : SCL이 HIGH인 동안 SDA가 LOW → HIGH
* 주소 뒤에는 읽기 /쓰기 방향 비트가 붙음
* 프레임 요소
	* Repeated START : STOP 없이 다시 START 쓰기 후 바로 읽기로 전환할 때

#### 3) I2C 장치 주소 탐색(Scanner) 메커니즘
* 주소 0x03 ~ 0x77에 차례로 0바이트 쓰기를 시도
* ACK가 돌아오면 그 주소에 장치가 있다는 뜻
#### 4) HD44780 캐릭터 LCD 컨트롤러와 내부 메모리 구조
* **제어 핀 구성**:
  * `RS (Register Select)`: `0`이면 명령어 레지스터(IR) 선택, `1`이면 표시 데이터 레지스터(DR) 선택.
  * `R/W (Read/Write)`: `0`이면 쓰기 동작, `1`이면 읽기 동작.
  * `E (Enable)`: 동작 래치 신호. **HIGH에서 LOW로 떨어지는 하강 에지(Falling Edge)** 에서 데이터를 LCD 내부로 래치(Latch)함.
* **내부 메모리 영역**:
  * **DDRAM (Display Data RAM)**: 16×2 패널 화면에 실제로 표출할 문자들의 ASCII 코드가 저장되는 80바이트 메모리.
    * 1행(Row 0) 주소: `0x00 ~ 0x0F`.
    * 2행(Row 1) 주소: `0x40 ~ 0x4F`.
  * **CGROM (Character Generator ROM)**: 기본 알파벳, 숫자, 특수 기호의 5×8 도트 매트릭스 폰트 패턴이 각인된 비휘발성 ROM.
  * **CGRAM (Character Generator RAM)**: 사용자가 임의로 정의한 사용자 지정 폰트 비트맵을 기록할 수 있는 RAM.

일단 이것만 보기
* 표시할 문자는 DDRAM(Display Data RAM)에 저장 
* 사용자 정의 문자는 CGRAM에 저장

#### 5) PCF8574 I/O 확장기(백팩)와 4-bit 통신 메커니즘
* **역할**: 마이크로컨트롤러로부터 I2C 직렬 데이터 1바이트를 수신하여 8개의 병렬 출력 핀(`P0 ~ P7`)으로 변환 인가함.
* **PCF8574 출력 핀과 HD44780 LCD 인터페이스 매핑 구조**:
  * `P0` $\longrightarrow$ **RS** (명령/데이터 구분)
  * `P1` $\longrightarrow$ **R/W** (쓰기 고정: 0)
  * `P2` $\longrightarrow$ **E** (Enable 스트로브 신호)
  * `P3` $\longrightarrow$ **BL / Backlight** (백라이트 제어 트랜지스터)
  * `P4 ~ P7` $\longrightarrow$ **DB4 ~ DB7** (LCD의 데이터 상위 4비트 버스 직결)
* **4-bit 전송 방식의 작동 원리**:
  * LCD의 DB0~DB3 핀을 배선에서 제외하고 오직 상위 DB4~DB7 라인만 제어함.
  * 1글자(8비트)를 출력하려면 반드시 **상위 니블(High Nibble, 상위 4비트)** 을 먼저 전송한 후, 연이어 **하위 니블(Low Nibble, 하위 4비트)** 을 시프트하여 2회에 나누어 전송함.
  * 각 니블을 보낼 때마다 E 핀을 HIGH로 올렸다가 LOW로 떨어뜨리는 펄스(`Lcd1602_PulseEnable`)를 반드시 인가해야만 LCD가 해당 니블 데이터를 래치함.

일단 이것만 보기
* PCF8574는 8비트 I2C I/O 익스팬더다
	* I2C로 받은 1바이트를 8개 출력 핀으로 내보냄
* 이 백팩이 LCD 핀에 배선되어 있다
	* I2C 한 바이트 = LCD 제어선 8개
**PCF8574 LCD 핀 매핑** :
	* 데이터 핀이 D4~D7 상위 4개만 연결된다
	* 한 글자(8비트)는 상위 니블 → 하위 니블 두 번에 나눠 보낸다
	* 각 니블은 E 핀을 1→0으로 토글해야 LCD가 값을 래치

### 2. 주차별 실습 진행 요약 (어떻게 수행했는가)
* **목표**: LPI2C1 모듈(100kHz)을 설정하고 PCF8574 백팩을 통해 1602 LCD를 초기화한 후 1행에 "Hello S32K3", 2행에 카운터 값을 출력.
* **하드웨어 배선**: 보드 I2C 핀(PTC6=SDA, PTC7=SCL 또는 PTD8/PTD9)을 LCD 백팩에 연결하고 5V 전원 및 접지(GND)를 결선.
* **설정 절차**: Config Tools에서 LPI2C1 모듈(Master Mode, 100 kHz)을 설정하고 핀을 Open-Drain으로 구성.
* **드라이버 모듈화 및 코드 구현**:
  * `lcd1602.c/.h` 파일 분리를 통해 전송 계층(`I2c_Lcd1602_Write`)과 상위 응용 API(`Lcd1602_Init`, `Clear`, `SetCursor`, `Putc`, `Puts`)를 격리.
  * `I2c_Scan()` 함수를 구현하여 슬레이브 주소 `0x27`을 확인한 뒤, KS0066U 규격에 따라 4비트 모드 진입 초기화 시퀀스(`0x30` $\to$ `0x30` $\to$ `0x30` $\to$ `0x20` $\to$ `Function Set` 등)를 순차 실행.
  * IPL 방식(`Lpi2c_Ip_MasterSendDataBlocking`)과 MCAL 방식(`I2c_SyncTransmit`)으로 하위 전송 함수만 교체하여 동일한 LCD 출력이 수행됨을 검증.

---

## [5주차] 하드웨어 인터럽트 아키텍처 (NVIC, SIUL2 EIRQ, ICU 드라이버)

### 1. 핵심 개념 및 이론적 배경

#### 1) 폴링(Polling)과 인터럽트(Interrupt)
* **폴링 (Polling)**: 
	* CPU가 입력 상태를 반복해서 읽음
	* 구현은 쉽지만 이벤트가 드물어도 계속 확인해야 함
* **인터럽트 (Interrupt)**: 
	* 이벤트가 발생하면 실행 흐름을 잠시 바꾼다
	* 하드웨어가 CPU를 처리 루틴(ISR)으로 분기시킨다. 

* 폴링: main loop -> 버튼 읽기 -> 처리 -> 버튼 읽기 -> ... 
* 인터럽트: main loop 실행 중 -> 버튼 edge 발생 -> ISR 진입 -> 플래그 갱신 -> main loop 복귀

| 방식 | 동작 | 장점 | 단점 |
| :--- | :--- | :--- | :--- |
| **폴링** | 루프에서 상태를 반복 확인 | 단순하고 흐름이 명확 | CPU 낭비, 늦게 반응 가능 |
| **인터럽트** | 사건 발생 시 하드웨어가 ISR 호출 | 즉각 반응, CPU 효율 상승 | 흐름이 비동기라 설계가 까다로움 |

> **인터럽트는 응답성이 좋지만, 공유 변수와 실행 순서를 더 신중히 다뤄야 한다.**

#### 2) Cortex-M7 예외와 인터럽트
* 시스템 예외(Reset, NMI, HardFault)와 외부 인터럽트를 함께 처리
* 관리 수단은 벡터 테이블 `__Vectors[]`
* 각 칸은 그 예외가 발생했을 때 점프할 핸들러 주소
	* 벡터 0 : 초기 스택 포인터(MSP)
	* 벡터 1 : Reset 핸들러 (시작 주소)
	* 벡터 2 : NMI
	* 벡터 3 : HardFault 
	* ... (벡터 0~15 = ARM 코어 예외) 
	* 벡터 16~ : 외부 인터럽트(IRQ 0~) - NVIC 관리

* **진입 · 복귀 · 우선순위**

| 개념 | 내용 |
| :--- | :--- |
| **진입** | 인터럽트 발생 시 8개 레지스터를 자동으로 스택에 푸시한 뒤 핸들러 실행 |
| **복귀** | EXC_RETURN 특수값으로 복귀하고 푸시한 레지스터를 자동 복원 |
| **Tail-chaining** | 연속된 인터럽트는 스택 복원과 재푸시를 생략해 빠르게 이어 처리 |
| **우선순위** | 숫자가 작을수록 높다.<br>그룹·서브 우선순위로 프리엠션 제어 |
#### 3) NVIC (Nested Vectored Interrupt Controller)
* 외부 인터럽트는 NVIC가 관리
* EIRQ들의 enable, pending, priority 상태를 관리
* 허용되어 있고 우선순위 조건이 맞으면 CPU가 ISR로 분기
* 빠르지만 공짜는 아니다 — 문맥 일부를 스택에 저장
* ISR이 길어지면 다른 인터럽트 응답이 늦어지고 main loop 처리도 밀림
	* 긴 출력, LCD 갱신, 복잡한 계산은 ISR에서 피해야 함

* **NVIC 레지스터와 SDK API**:

| 레지스터 | 역할 | SDK API |
| :--- | :--- | :--- |
| **ISER / ICER** | IRQ 개별 enable / disable | NVIC_EnableIRQ()<br>NVIC_DisableIRQ() |
| **ISPR / ICPR** | pending 설정 / 해제 | NVIC_SetPendingIRQ()<br>NVIC_ClearPendingIRQ() |
| **IPR** | 우선순위 설정 | NVIC_SetPriority() |

> **RTD를 쓰면 등록 과정을 Config Tools 생성 코드와 콜백 등록이 대신한다**

#### 4) S32K3의 외부 핀 인터럽트 라우팅 구조 (SIUL2 EIRQ와 RTD ICU)
* S32K3의 외부 핀 입력은 SIUL2를 통해 인터럽트 이벤트로 라우팅
* 32개 EIRQ가 4개 NVIC 벡터(IRQ 53~56)로 묶인다
* RTD에서는 Siul2_Icu_Ip 드라이버가 이 기능을 담당
#### 5) ISR 작성:
* LCD 출력과 printf()는 ISR 밖에서 수행
* I2C LCD 출력은 blocking I2C write를 여러 번 포함해 처리 시간이 긺
#### 6) 공유 변수와 `volatile`
* 공유 변수는 volatile로 선언
* 이 값이 현재 코드 흐름 밖에서 바뀔 수 있다고 컴파일러에 알림
#### 7) 버튼 채터링
* 기계식 버튼은 한 번 눌러도 접점이 여러 번 붙었다 떨어짐
* 인터럽트에서는 카운터가 여러 번 증가하는 현상으로 바로 드러남
* 수업 코드는 tick 차이로 일정 시간 안의 edge를 무시한다
```
if ((now - last) < DEBOUNCE_TICKS) { return; } 
last = now; 
```

### 2. 주차별 실습 진행 요약 (어떻게 수행했는가)
* **목표**: USER_SW0(SW5) 버튼을 누를 때마다 인터럽트를 통해 D13 LED를 토글하고, 4주차에 제작한 1602 LCD 모듈의 누적 누름 카운터를 갱신.
* **하드웨어 핀 및 인터럽트 구성**:
  * 버튼: `PTB26` (USER_SW0, SW5) $\longrightarrow$ SIUL2 EIRQ[13] 채널 매핑.
  * 신호 특성: 누를 때 High가 되므로 Activation Condition을 `Rising Edge`로 설정.
  * NVIC 인터럽트 라우팅: EIRQ[13]이 속한 `SIUL_1_IRQn` (EIRQ 8~15 공유 벡터, 우선순위 10) 및 핸들러 `SIUL2_EXT_IRQ_8_15_ISR` 등록.
* **설정 및 구현 (IPL vs MCAL)**:
  * **IPL (`chap05_interrupt_button_ipl`)**: Config Tools에서 Siul2_Port, Siul2_Dio, Siul2_Icu, IntCtrl_Ip를 설정하고, `Siul2_Icu_Ip_Init()`, `EnableInterrupt()`, `EnableNotification()` 호출 후 `IntCtrl_Ip_Init()`으로 NVIC를 구동.
  * **MCAL (`chap05_interrupt_button_mcal`)**: Port, Dio, Icu, Platform 모듈을 설정하고 `Port_Init()`, `Platform_Init()`, `Icu_Init()`, `Icu_EnableNotification()`, `Icu_EnableEdgeDetection()` 순으로 초기화.
* **역할 분담 검증**: 콜백 함수 `UserSw0_Callback()` 내부에는 `g_press_count++` 및 `g_led_request ^= 1U`의 `volatile` 변수 갱신만 두고, `main()` 루프에서 플래그를 감지하여 LED를 토글하고 LCD 화면에 카운터를 출력하여 채터링 및 ISR 지연 없는 정상 구동을 확인.

---

## [시험 대비] 마크다운(.md) 필기 내용 기반 단독 출제 핵심 파트

### 1) [3주차 9.15] C 비트 연산자 (중간고사 확정 출제 항목)
* **연산자 정의 및 원리**:
  * `&` (Bitwise AND): 두 비트가 모두 1일 때만 1 반환 (특정 비트 클리어 및 비트 추출/마스킹용).
  * `|` (Bitwise OR): 두 비트 중 하나라도 1이면 1 반환 (특정 비트 세트/강제 활성화용).
  * `^` (Bitwise XOR): 두 비트의 값이 서로 다를 때만 1 반환 (특정 비트 반전/토글 플래그용).
  * `~` (Bitwise NOT): 비트를 0은 1로, 1은 0으로 반전 (1의 보수화).
  * `<<` (Left Shift): 비트를 지정된 수만큼 왼쪽으로 이동하고 우측 빈자리는 0으로 채움 ($N$칸 이동 시 $2^N$ 곱셈).
  * `>>` (Right Shift): 비트를 지정된 수만큼 오른쪽으로 이동 ($N$칸 이동 시 $2^N$ 나눗셈 몫).
* **2진수/10진수 연산 예제**:
  * $5\ \&\ 3 \implies 0101_2\ \&\ 0011_2 = 0001_2 = 1_{10}$
  * $5\ \vert{}\ 3 \implies 0101_2\ \vert{}\ 0011_2 = 0111_2 = 7_{10}$
  * $5\ \text{\textasciicircum}\ 3 \implies 0101_2\ \text{\textasciicircum}\ 0011_2 = 0110_2 = 6_{10}$ *(메모 원문의 0101=5 표기는 오기이며 실제 계산값은 0110=6)*
  * $5 \ll 2$:
    * 이동 전: `0 0 0 0 0 1 0 1` ($= 10\text{진수 } 5$)
    * 2칸 좌측 이동 후: `0 0 0 1 0 1 0 0` ($= 10\text{진수 } 20$, 우측 빈칸은 0으로 채움)
  * $5 \gg 2$:
    * 이동 전: `0 0 0 0 0 1 0 1` ($= 10\text{진수 } 5$)
    * 2칸 우측 이동 후: `0 0 0 0 0 0 0 1` ($= 10\text{진수 } 1$, 끝의 비트 버려짐)
    * (참고: $20 \gg 2 \implies 00010100_2 \gg 2 = 00000101_2 = 5_{10}$)

---

### 2) [4주차 9.29.md] SIUL2 레지스터 구조체 주소 오프셋 계산 (시험 출제 1순위)
* **원문 코드 및 구조체**:
```c
  typedef struct {
      uint8_t RESERVED_0 [4];
      __I uint32_t MIDR1;  /**< SIUL2 MCU ID Register #1, offset: 0x4 */
      __I uint32_t MIDR2;  /**< SIUL2 MCU ID Register #2, offset: 0x8 */
      uint8_t RESERVED_1 [4];
      __I uint32_t DISR0;  /**< offset: 0x10 */
  } SIUL2_Type, *SIUL2_MemMapPtr;

```

- 수학적 주소 계산 도출 과정:
  1. 구조체의 시작 주소(Base Address) 즉, RESERVED_0[4]의 시작 주소가 0x4029 0000으로 주어짐.
  2. RESERVED_0은 1바이트 크기(uint8_t)의 요소 4개로 이루어진 배열이므로 정확히 4바이트(0x4029 0000 ~ 0x4029 0003)를 점유함.
  3. 따라서 그 다음 멤버인 MIDR1의 시작 오프셋은 +0x4가 되며, 물리 주소는 0x4029 0004가 됨.
  4. MIDR1은 32비트 레지스터(uint32_t)이므로 4바이트(0x4029 0004 ~ 0x4029 0007)를 차지하며, 그 다음 레지스터인 MIDR2의 주소는 오프셋 0x8이 적용된 0x4029 0008이 됨.
  5. MIDR2(4바이트, 0x4029 0008 ~ 0x4029 000B) 뒤에 다시 RESERVED_1[4](4바이트, 0x4029 000C ~ 0x4029 000F)가 존재하므로, DISR0의 시작 주소는 오프셋 0x10인 0x4029 0010이 됨.

- 관련 시험 필수 다운로드 문서:
  - S32K312 Data Sheet
  - S32K312 Reference Manual
  - S32K312EVB-Q172 회로도 (Schematic)

---

### 3) [5주차 10.6.md] 시스템 하드웨어 체인 및 LPI2C 분주 클럭 수식 계산

- 소프트웨어 추상화 계층 순서 암기:
  $$\text{C 포인터 직접 접근} \longrightarrow \text{C 함수/라이브러리} \longrightarrow \text{HAL} \longrightarrow \text{IP Layer (IPL)} \longrightarrow \text{AUTOSAR MCAL}$$
  *(수업 진행 지향점: MCAL)*

- 하드웨어 인터페이스 직렬 체인 구조:
  $$\mathbf{S32K312\ MCU} \xrightarrow[\text{(SDA, SCL 2선)}]{\text{I2C 통신}} \mathbf{PCF8574\ (I/O 확장 백팩)} \xrightarrow[\text{(RS, RW, E, DB4-7)}]{\text{8-Bit 병렬 제어선}} \mathbf{HD44780\ (LCD 컨트롤러)} \xrightarrow{\text{도트 매트릭스}} \mathbf{16\times2\ LCD\ 패널}$$

- LPI2C 모듈 동작 클럭 및 Prescaler 분주 계산:
  - 입력 소스 클럭: $\text{AIPS\_SLOW\_CLK} \longrightarrow \text{LPI2C1\_CLK} = \mathbf{30\,\text{MHz}}$
  - Prescaler 설정을 `_DIV_16`으로 선택했을 때의 클럭 계산:
    $$\text{LPI2C 통신 모듈 클럭} = \frac{\text{AIPS\_SLOW\_CLK}}{\text{DIV\_16}} = \frac{30\,\text{MHz}}{16} = \mathbf{1.875\,\text{MHz}}\ (\approx \text{약 } 2\,\text{MHz})$$
  - 1.875 MHz 클럭을 기반으로 High/Low Period 및 Delay 카운트를 설정하여 최종 100 kHz I2C 보율을 합성함.

---

### 4) [6주차 10.13.md] 폴링 vs 인터럽트 정밀 비교 테이블 (시험 서술형 대비)

| 비교 기준 항목          | 폴링 (Polling)                                   | 인터럽트 (Interrupt)                                  |
| :---------------- | :--------------------------------------------- | :------------------------------------------------ |
| **작동 메커니즘**       | CPU가 주기적으로 주변장치 레지스터를 직접 읽어 이벤트 발생 여부를 반복 확인   | 이벤트 발생 시 하드웨어가 CPU에 신호를 주어 실행 중인 루틴을 멈추고 ISR로 분기  |
| **CPU 자원 효율성**    | 이벤트 미발생 시에도 계속 검사 루프를 돌기 때문에 심각한 CPU 연산 자원 낭비  | 이벤트가 없을 때는 본래 연산만 수행하므로 CPU 연산 자원 낭비가 전혀 없음       |
| **응답성 (Latency)** | 메인 루프 내 지연 함수(Delay)나 다른 연산에 의해 이벤트 반응 시간이 지연됨 | 우선순위에 따라 즉각 현재 작업을 선점하므로 나노~마이크로초 단위로 즉시 반응       |
| **설계 및 디버깅**      | 실행 흐름이 순차적이고 결정론적이어서 구현이 쉽고 디버깅이 단순함           | 비동기 호출 특성으로 인해 volatile 선언, 레이스 컨디션 등 동기화 설계가 복잡함 |
