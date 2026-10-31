# S32K312 임베디드 시스템 정리 (1~6주차)

> 1. **1주차** — 임베디드 시스템 개요, Cortex-M7 아키텍처, UART
> 2. **2주차** — Memory-Mapped I/O와 SIUL2 레지스터로 GPIO 직접 제어
> 3. **3주차** — 소프트웨어 추상화 계층 (IPL vs AUTOSAR MCAL)
> 4. **4주차** — I2C 통신과 캐릭터 LCD (HD44780 + PCF8574)
> 5. **5주차** — 인터럽트 아키텍처 (NVIC, SIUL2 EIRQ, ICU)
> 6. **6주차** — ADC (양자화, SAR, 하드웨어 평균 + 이동 평균)
> 7. **시험 대비** — 필기 기반 단독 출제 파트

---

## 1주차 — 임베디드 시스템 개요, Cortex-M7 아키텍처, UART

### 1. 핵심 개념

#### 1) 임베디드 시스템의 정의

특정 기계·제품 내부에 **내장(Embedded)** 되어, 사전에 정의된 기능만 전담 수행하는 컴퓨터 시스템.

- 실행되는 기계가 아닌 **다른 기계(PC)에서 개발**한다.

| 구분 | 범용 컴퓨터 (PC) | 임베디드 시스템 |
| :--- | :--- | :--- |
| 용도 | 사용자가 임의의 프로그램을 설치·실행 | 정해진 입력을 읽고 정해진 출력을 제어 |
| 실행 방식 | 실행 파일을 OS 위에서 바로 실행 | ELF를 보드의 Flash에 다운로드한 뒤 실행 |

**C 코드가 보드에서 돌아가기까지 (5단계)**

```
소스 코드 → 컴파일/링크 → ELF → OpenSDA / PEmicro → MCU Flash → 실행
```

#### 2) 임베디드 시스템의 4대 특성

| 특성 | 설명 | 예시 |
| :--- | :--- | :--- |
| **자원 제약** (Resource Constrained) | 제한된 CPU 성능, 소용량 메모리(Flash, SRAM), 전력 예산 안에서 동작 | — |
| **실시간성** (Real-Time) | 결과의 정확성 + **마감 시간(Deadline) 엄수** | 에어백 전개는 수 ms 이내 |
| **전용성** (Dedicated Purpose) | 목적에 특화된 HW/SW 구성 | 세탁기 제어기는 세탁 시퀀스만 제어 |
| **하드웨어 의존성** | 타깃 MCU의 핀·클럭·레지스터를 직접 제어 | 핀 설정 오류 시 구동 전면 중단 |

> [!note] 차량용 ECU
> 일반적인 차량에는 엔진 제어, ABS, 조향, BMS 등을 위해 **수십~100개 이상의 ECU**가 탑재된다.

#### 3) 범용 MCU vs 차량용 MCU — "안전 메커니즘"

**ASIL (Automotive Safety Integrity Level)**
- ISO 26262에서 정의하는 차량 기능 안전 무결성 등급
- **ASIL-A** (낮음) → **ASIL-D** (가장 엄격, 제동·조향 등 인명 피해가 큰 기능)

**S32K3의 하드웨어 고장 검출 메커니즘**

| 메커니즘 | 역할 |
| :--- | :--- |
| **메모리 ECC** | SRAM/Flash 비트 오류 실시간 검출, **1비트 에러 자동 정정** |
| **Lockstep** | 두 코어가 같은 명령을 동시에 실행하고 클럭 사이클 단위로 결과를 대조 |
| **감시 회로** | 전압·온도·클럭 감시 하드웨어 내장 |

#### 4) Cortex-M7 프로세서 코어

**CPU 특성**
- S32K312의 연산 담당, **ARMv7-M** 기반 32비트 고성능 코어
- OS 없이 부팅 가능, 빠른 인터럽트 반응성
- **Thumb-2 명령어 집합**: 16/32비트 명령어 혼용 → 코드 밀도와 성능의 균형

**코어 레지스터**

| 레지스터 | 역할 |
| :--- | :--- |
| `R0 ~ R12` | 범용 연산, 함수 인자, 임시 데이터 |
| `R13 (SP)` | 스택 최상단. **MSP**(리셋 직후·예외/인터럽트 처리) / **PSP**(RTOS 태스크별 스택) |
| `R14 (LR)` | 함수 호출 후 복귀할 주소 |
| `R15 (PC)` | 다음 실행할 명령어 주소 |
| `xPSR` | 조건 플래그, 예외 상태 정보 |

**예외 처리와 벡터 테이블**
- 외부 핀 변화, 타이머 만료, UART 수신 등 **모든 하드웨어 이벤트를 예외(Exception)로 통합 관리**
- **NVIC**가 enable, pending, 우선순위, 중첩 처리를 관리
- **벡터 테이블** = 예외별 핸들러 주소를 담은 배열
  - 0번: 초기 스택 포인터 (Initial MSP)
  - 1번: Reset Handler 주소

**리셋 흐름**

```
Reset → Vector Table → Reset Handler → Runtime init → main()
```

**시스템 부팅 흐름**

```
Power-On Reset → BAF → IVT 확인 → 사용자 벡터 테이블 → startup → main()
```

- **BAF** (Boot Assist Flash): 부팅을 돕는 NXP 내장 코드
- **IVT** (Image Vector Table): 부팅 이미지와 사용자 코드 진입 정보

#### 5) 메모리 맵과 Memory-Mapped I/O

| 영역 | 용도 |
| :--- | :--- |
| **Code Flash** | 실행 코드, 읽기 전용 데이터(RO Data) |
| **Data Flash** | 전원 차단 후에도 유지할 설정값, 시스템 파라미터 |
| **SRAM** | 전역 변수, 스택, 런타임 데이터 |
| **TCM** | 빠르고 지연이 예측 가능한 코드/데이터 |
| **Peripheral** | UART, GPIO, CAN 등의 제어 레지스터 |

> [!important] 같은 C 문장, 다른 의미 — `*ptr = value;`
> - `ptr`이 **SRAM** 주소 → 변수 저장
> - `ptr`이 **Peripheral** 주소 → 핀 전압, 송수신, 인터럽트 상태 등 **물리 하드웨어가 즉시 바뀜**

#### 6) 클럭 트리

```
FIRC / SIRC / FXOSC → PLL → System / Bus / Peripheral Clock
```

| 소스 | 설명 |
| :--- | :--- |
| **FIRC** | 내부 고속 RC 발진기 |
| **SIRC** | 내부 저속 저전력 RC 발진기 |
| **FXOSC** | 외부 정밀 크리스털 발진기 |
| **PLL** | 입력 클럭을 체배하여 고속 시스템 클럭 생성 |

- CPU, 버스, UART 등 모든 주변장치는 클럭 기준으로 동작
- S32K312 Cortex-M7 코어 클럭: **120 MHz**

#### 7) AUTOSAR와 RTD 명명 규칙

- **AUTOSAR**: 차량 소프트웨어 표준 아키텍처
- **RTD** (Real Time Driver): AUTOSAR 기반 NXP 주변장치 드라이버
- 함수 이름 규칙: **`모듈_기능`** → 예) `Lpuart_Uart_Ip_SyncSend()`
- 모듈·기능·드라이버 계층을 구분해 설정과 코드를 관리하기 위한 구조

#### 8) UART 통신

- 가장 기본적인 **비동기** 방식
- 클럭 선 없이 **TX / RX 2선**으로 양방향 전송
- 송수신 양쪽이 **같은 보율(Baud Rate)** 을 사용해야 함

**데이터 프레임 (8-N-1)**

```
[Idle: HIGH] → [Start: LOW] → [D0(LSB) ~ D7(MSB)] → [Parity: 선택] → [Stop: HIGH] → [Idle: HIGH]
```

| 구간 | 설명 |
| :--- | :--- |
| Idle | 데이터 없을 때 `HIGH` 유지 |
| Start Bit | `LOW`로 떨어뜨려 프레임 시작 알림 |
| Data Bits | 8비트를 **LSB → MSB** 순서로 전송 |
| Parity Bit | 단순 오류 검출용 (선택) |
| Stop Bit | `HIGH`로 복귀, 프레임 끝 알림 |

**OpenSDA VCOM 경로** — USB 케이블 하나로 디버깅 + 시리얼 통신

```
S32K312 (LPUART6) → OpenSDA (VCOM 변환) → USB → PC 시리얼 터미널 (PuTTY)
```

#### 9) `printf()` 리다이렉션 (Retargeting)

- `printf()`는 최종적으로 `_write()` 같은 저수준 출력 함수를 호출
- PC는 콘솔·파일로 연결되지만 **MCU에는 기본 화면이 없음**
- → `_write()`를 직접 구현해 출력 바이트를 LPUART로 보냄

```c
int _write(int file, char *ptr, int len) {
    /* ptr의 len 바이트를 LPUART로 송신 */
}
```

**출력 경로**

```
printf() → _write() → Lpuart_Uart_Ip_SyncSend() → LPUART6 TX (PTA16)
        → OpenSDA VCOM → USB → PC 시리얼 터미널
```

### 2. 실습 요약

> [!example] 목표
> LPUART6를 활성화하고 `printf()`를 리다이렉션하여 PC 터미널(PuTTY/Tera Term)로 문자열 출력

| 항목 | 내용 |
| :--- | :--- |
| 핀 매핑 | `PTA16` = LPUART6_TX, `PTA15` = LPUART6_RX (OpenSDA VCOM 직결) |
| Clock_Ip | LPUART6_CLK **30 MHz** 활성화 |
| Siul2_Port_Ip | 핀 Mux 및 방향 설정 |
| Lpuart_Uart_Ip | **115200 bps, 8N1** |

**코드 흐름**
1. `_write()` 안에서 `Lpuart_Uart_Ip_SyncSend()` 호출하도록 구현
2. `Clock_Ip_Init()` → `Siul2_Port_Ip_Init()` → `Lpuart_Uart_Ip_Init()` 순서로 초기화
3. `printf("Hello S32K3, %s %s\r\n", ...)` 호출 → PC 화면에서 확인

---

## 2주차 — GPIO 하드웨어 주소 직접 접근 (Memory-Mapped I/O와 SIUL2)

### 1. 핵심 개념

#### 1) Memory-Mapped I/O vs 일반 RAM 접근

- RAM, Flash, 주변장치 레지스터가 **하나의 주소 공간**에 배치됨
- CPU는 **같은 load/store 명령**으로 변수와 하드웨어를 모두 다룸

| 목적지 주소 | 의미 |
| :--- | :--- |
| SRAM | 변수 읽기/쓰기 |
| Flash | 코드/상수 읽기 |
| Peripheral | 하드웨어 레지스터 |

> [!important] `*ptr = 1U;`
> - SRAM을 가리키면 → C 변수 값 변경
> - GPIO 출력 레지스터를 가리키면 → **실제 핀의 전압 레벨(High/Low) 변경**

#### 2) `volatile` 키워드

**문제 배경** — 컴파일러는 의미가 안 변한다고 판단하면 메모리 접근을 **제거(Elimination)** 하거나 **재배치(Reordering)** 한다.

```c
while (STATUS_REG == 0U) { /* 대기 */ }
```

- 일반 변수라면: 루프 안에서 수정하는 코드가 없으니 **1회만 읽고 캐싱** → 무한 루프 / 루프 왜곡
- 하드웨어 레지스터라면: CPU 외부 회로에 의해 **값이 실시간으로 바뀔 수 있음**

**`volatile`의 의미**
> "이 주소 접근은 **매번 실제로 수행**하고, 생략하거나 순서를 바꾸지 말라."

```c
#define STATUS_REG (*(volatile uint32_t *) 0x40000000UL)
```

> [!warning] `volatile` 누락 시
> - LED 켜고 끄는 쓰기가 무의미한 연속 쓰기로 간주되어 **삭제**될 수 있음
> - `Delay` 루프가 통째로 사라져 **점멸이 멈춤**

#### 3) 비트 마스킹 4대 패턴

레지스터 하나(32비트)에 여러 필드가 밀집 → **다른 필드를 건드리지 않고** 원하는 비트만 조작

| 동작 | 코드 |
| :--- | :--- |
| n번 비트 **Set** | `reg \|= (1U << n);` |
| n번 비트 **Clear** | `reg &= ~(1U << n);` |
| n번 비트 **Toggle** | `reg ^= (1U << n);` |
| **필드 변경** (Read-Modify-Write) | `reg = (reg & ~mask) \| value;` |

**GPIO 출력으로 만들기 (S32K312)**
1. MSCR의 **출력 버퍼 enable 비트(OBE)** 를 Set
2. **핀 기능 선택 필드(SSS)** 를 GPIO 기능으로 설정

#### 4) SIUL2 (System Integration Unit Lite2)

핀 기능, GPIO 입출력, 핀 다중화, 입력 신호 라우팅, 출력 드라이버 설정 담당

| 레지스터 | 역할 |
| :--- | :--- |
| **MSCR[n]** | 핀 속성: 출력/입력 enable, mux(핀 기능), 입출력 버퍼, 전기적 속성 |
| **IMCR[n]** | 주변장치 입력 신호가 받을 **Pad 선택** |
| **GPDO[n]** | GPIO 출력 값 쓰기 |
| **GPDI[n]** | GPIO 입력 값 읽기 |
| **PGPDO[n] / PGPDI[n]** | 여러 GPIO를 병렬로 쓰기/읽기 |

**MSCR — 출력 방향 (내부 → 외부 핀)**
패드 1개에 어떤 내부 기능의 신호를 내보낼지 선택

```
[GPIO]  ──┐
[UART]  ──┼──► [ Mux (MSCR) ] ──► [ 패드 ]
[eMIOS] ──┘
```

**IMCR — 입력 방향 (외부 핀 → 내부)**
특정 내부 입력 기능을 어떤 패드에서 받을지 선택

```
[ 외부 패드 1 ] ──┐
[ 외부 패드 2 ] ──┼──► [ Mux (IMCR) ] ──► [ EIRQ (내부 인터럽트) ]
[ 외부 패드 3 ] ──┘
```

#### 5) MSCR로 GPIO 출력 설정

| 필드 | 설정 |
| :--- | :--- |
| **OBE** (Output Buffer Enable) | Set |
| **SSS** (Source Signal Select) | `0000b` = GPIO 기능 |

```
MSCR 읽기 → SSS를 GPIO로 → OBE Set → MSCR에 다시 쓰기
```

#### 6) SIUL2 물리 주소와 GPDO 역순 배치

| 매크로 | 값 | 단위 |
| :--- | :--- | :--- |
| `SIUL2_BASE_ADDR` | `0x40290000UL` | — |
| `SIUL2_MSCR_OFFSET` | `0x0240UL` | 32비트 배열 |
| `SIUL2_GPDO_OFFSET` | `0x1300UL` | 8비트 배열 |

**MSCR 주소 계산** — 4바이트 단위로 정방향 증가

$$\text{MSCR}[n] = \text{0x40290000} + \text{0x0240} + (4 \times n)$$

> [!danger] 시험·개발 핵심 — GPDO 4바이트 단위 역순 배치
> GPDO 바이트 레지스터는 **워드(4개) 단위로 역순** 배치되어 있다.
>
> | 오프셋 | 레지스터 | | 오프셋 | 레지스터 |
> | :--- | :--- | :--- | :--- | :--- |
> | `0x1300` | GPDO3 | | `0x131C` | GPDO31 |
> | `0x1301` | GPDO2 | | `0x131D` | GPDO30 |
> | `0x1302` | GPDO1 | | `0x131E` | **GPDO29** |
> | `0x1303` | GPDO0 | | `0x131F` | GPDO28 |

**오프셋 계산 매크로**

```c
#define SIUL2_GPDO_BYTE_OFFSET(index) \
    (SIUL2_GPDO_OFFSET + (((uint32_t)(index) & ~3UL) + (3UL - ((uint32_t)(index) & 3UL))))
```

**GPIO[29] 대입**

```
(29 & ~3) + (3 - (29 & 3))
= 28 + (3 - 1)
= 30 (0x1E)
→ 최종 오프셋: 0x1300 + 0x1E = 0x131E
```

#### 7) MSCR 번호 ≠ GPIO 번호

> [!warning] 두 값은 서로 다른 레지스터의 인덱스 → **한 변수로 취급 금지**

**하드웨어 문서 탐색 3단계**
1. **보드 매뉴얼 (HWUM)** — 어떤 LED/스위치가 어떤 MCU 핀에 연결됐는가
2. **IOMUX 표** — 그 핀의 MSCR 번호, GPIO 번호, ALT 기능
3. **RTD 헤더 / Reference Manual** — 레지스터 주소, 필드, 구조체 이름

#### 8) Active High vs Active Low

| 방식 | `1` 쓰기 | `0` 쓰기 |
| :--- | :--- | :--- |
| **Active High** | 점등 | 소등 |
| **Active Low** | 소등 | 점등 |

#### 9) 직접 주소 접근 vs SDK 헤더

```c
// 직접 주소 접근: 주소 계산 후 volatile 포인터로 역참조
#define SIUL2_MSCR(index) \
    (*(volatile uint32_t *)(SIUL2_BASE_ADDR + SIUL2_MSCR_OFFSET + (4UL * (index))))

// SDK 헤더: 구조체 필드 이름 사용
IP_SIUL2->MSCR[29] = value;
IP_SIUL2->GPDO29   = 1U;
```

| 비교 항목 | 직접 주소 매크로 | SDK 헤더 |
| :--- | :---: | :---: |
| 주소 계산 이해 | 높음 | 낮음 |
| 코드 가독성 | 낮음 | 높음 |
| 오타 위험 | 높음 | 낮음 |
| 이식성 | 낮음 | 높음 |
| 실습 목적 | 레지스터 구조 이해 | 실무형 접근 이해 |

#### 10) 클럭 게이팅

- 주변장치는 **해당 모듈의 클럭이 공급될 때만** 동작한다.

### 2. 실습 요약

> [!example] 목표
> Config Tools 없이 **C 코드만으로** D13(PTA29) 빨간 LED 점멸
> 1. 주소 연산 + 매크로로 레지스터 직접 제어
> 2. SDK 헤더(`IP_SIUL2`) 방식으로 전환하여 동일 동작 검증

| 항목 | 내용 |
| :--- | :--- |
| Target | S32K312 / S32K312EVB-Q172 |
| LED | D13 / RGBLED0_RED / **PTA29** / Active High |
| 레지스터 | `MSCR29`, `GPDO29` (Offset `0x131E`) |
| 도구 | S32DS 3.6.7, GCC 10.2, PEmicro 12.7.0 |

**진행 단계**

1. **프로젝트 생성** — `File → New → S32DS Application Project`, 디바이스 S32K312, GCC 10.2 → `chap02_gpio_bare` (SDK/RTD 미사용)
2. **`gpio_bare.h` 작성**
   - 베이스/오프셋 주소 선언
   - GPDO 역순 매크로 `SIUL2_GPDO_BYTE_OFFSET(index)`
   - `volatile` 역참조 매크로 `SIUL2_MSCR(index)`, `SIUL2_GPDO(index)`
   - 마스크: OBE(비트 21), SSS(비트 3:0, GPIO=0)
   - 인라인 함수 `GpioBare_SetOutput()`, `GpioBare_Write()`
3. **`main.c` 작성**
   - `#define USE_SDK_HEADER_ACCESS (0)`
   - `LedInit()`: OBE 켜기, SSS=GPIO, 초기 Off
   - `LedWrite()`, `Delay(volatile uint32_t count)`
   - 무한 루프에서 400만 카운트 간격으로 점멸
4. **빌드·다운로드·실행** — `0 errors` + `.elf` 확인 → Debug Configurations에서 `FLASH_PNE` 선택 → Resume → 점멸 확인
5. **SDK 헤더 전환** — `USE_SDK_HEADER_ACCESS (1)`로 변경, `IP_SIUL2->MSCR[29]` / `IP_SIUL2->GPDO29` 사용 → 동일 동작 확인

---

## 3주차 — 소프트웨어 추상화 계층 (IPL vs AUTOSAR MCAL)

### 1. 핵심 개념

#### 1) 추상화의 본질

> [!quote] 추상화란?
> 하드웨어를 숨기는 것이 아니라, **하드웨어 의존성을 어느 계층에 모아둘지 결정하는 설계 기법**

**추상화 계층 (NXP 기준, 위가 상위)**

| 계층 | 구성 요소 |
| :--- | :--- |
| **Application** | 응용 로직 |
| **AUTOSAR BSW / RTE** | 서비스 · 통신 · OS |
| **MCAL** | Port / Dio / Adc / Can |
| **IPL** | 벤더 Low-Level Driver |
| **레지스터 / 베어메탈** | SIUL2 MSCR / GPDO (2주차) |

> [!note]
> 흔히 말하는 **HAL**은 위 구조에서 **IPL + MCAL**에 해당한다.

**NXP RTD 구성**
- **HLD** (High Level Driver): MCAL용 인터페이스 함수
- **IPL** (IP Level Driver): 가장 낮은 레벨의 인터페이스 함수
- 각 층은 아래 층을 함수 이름으로 감싸서, 위 층이 하드웨어 세부를 몰라도 동작하게 함
- **대가**: 코드가 늘고 빌드가 커짐

**추상화의 이득**

| 이득 | 의미 | 사례 |
| :--- | :--- | :--- |
| **이식성** | HW가 바뀌어도 응용 코드는 그대로 | MCU 교체 시 드라이버만 교체 |
| **안전성** | 표준 인터페이스로 검증·재사용 | 인증된 드라이버를 여러 차종에 |
| **검증 비용** | 한 번 검증한 계층을 재사용 | 레지스터 코드를 매번 재검증하지 않음 |

#### 2) IPL (IP Level Driver)

특정 하드웨어 IP(SIUL2, LPI2C 등)에 맞춘 **벤더 전용 저수준 드라이버**

```c
// 직접 레지스터 접근 (매크로)
SIUL2_GPDO(29U) = 1U;

// IPL 호출 (함수) — 포트 half + half 안의 핀 번호
Siul2_Dio_Ip_WritePin(PTA_H_HALF, 13U, 1U);
```

**IPL의 성격**
- ✅ 레지스터 주소 계산과 접근 폭은 RTD 드라이버 안에 있음
- ✅ 직접 만든 HAL보다 RTD의 구현·검증을 재사용 가능
- ⚠️ 특정 IP의 이름과 자료형이 코드에 드러남
- ⚠️ 다른 MCU/IP로 옮기면 호출 API 자체가 바뀔 수 있음

#### 3) AUTOSAR MCAL

- AUTOSAR Classic Platform이 정의한 표준 추상화 계층
- **BSW의 가장 아래**에 위치, Port · Dio · Gpt · Adc · Can 등 표준 모듈로 구성
- **NXP RTD가 바로 이 MCAL의 구현체**

**BSW 계층 (높음 → 낮음)**

```
Services → ECU Abstraction Layer → Complex Driver → MCAL
```

> [!important] 핵심 설계 철학 — 설정과 코드의 분리
> - 핀 방향·기능 같은 **설정은 코드에 직접 쓰지 않는다**
> - Config Tools가 생성하는 **초기화 구조체**에 담는다
> - 응용 코드는 `Port_Init()`으로 구조체를 적용하고, `Dio_WriteChannel()`로 **동작만** 호출

**차량 산업에서 MCAL을 쓰는 이유**
- 차량 SW는 ASIL 등급 인증·검증 필수
- 한 번 인증한 드라이버를 여러 차종·MCU에 재사용 가능
- **도구·구조체·생성 단계의 번거로움 < 검증 비용 절감**

#### 4) Port 드라이버 vs Dio 드라이버

| 드라이버 | 역할 | 예시 |
| :--- | :--- | :--- |
| **Port** | 하드웨어 **정적** 특성 초기화 (모드, 방향, 전기적 속성, 초기 상태) | PTA29를 GPIO 출력으로 설정 |
| **Dio** | 런타임 **동적** 레벨 제어 (읽기, 쓰기, 토글) | 그 채널에 `STD_HIGH` / `STD_LOW` 쓰기 |

#### 5) IPL vs MCAL 비교

| 비교 항목 | RTD IPL | AUTOSAR MCAL |
| :--- | :--- | :--- |
| API 출처 | RTD의 SIUL2 IP driver | RTD의 AUTOSAR MCAL driver |
| 설정 위치 | Pins 설정 + 생성된 pin-mux 구조체 | Config Tools의 Port/Dio 설정 |
| 호출 단위 | SIUL2 포트 half + 핀 번호 | AUTOSAR Dio channel ID |
| 초기 학습 비용 | 낮음 ~ 중간 | 낮음 ~ 중간 |
| 검증 단위 | SIUL2 IP API + pin-mux 생성 코드 | Port/Dio API, 설정 파일, 생성 코드 |
| 이식성 | 같은 SIUL2 IP 계열 안에서 유리 | 지원 MCU/보드 범위 안에서 유리 |

### 2. 실습 요약

> [!example] 목표
> 같은 동작(D13 LED 점멸)을 **IPL / MCAL** 두 프로젝트로 구현하여 바이너리 크기와 소스 의존성 비교

**IPL — `chap03_gpio_ipl`**
- Pins Tool에서 PTA29를 출력으로 설정 → 생성된 `Siul2_Port_Ip_Init()` 호출
- 상위 Half 매크로로 제어: `Siul2_Dio_Ip_WritePin(PTA_H_HALF, 13U, level)`

**MCAL — `chap03_gpio_mcal`**
- Port 모듈: PTA29 출력 설정
- Dio 모듈: Port 1, Channel 13 → 심볼명 `RGBLED0_RED`
- `Port_Init(NULL_PTR)`로 정적 설정 로드
- 물리 핀 번호 대신 생성된 심볼 사용: `Dio_WriteChannel(DioConf_DioChannel_RGBLED0_RED, level)`

**비교 방법** — 빌드 콘솔의 `arm-none-eabi-size` 출력에서 `.text` 섹션(Flash) 크기 비교

---

## 4주차 — I2C 통신과 캐릭터 LCD (HD44780 + PCF8574)

### 1. 핵심 개념

#### 1) I2C 버스

- **SDA**(데이터) + **SCL**(클럭) 2선
- 여러 장치가 함께 연결되므로 각 장치는 **고유 주소**를 가짐

> [!note] 오픈 드레인과 풀업
> - push-pull처럼 HIGH/LOW를 모두 구동하지 않음
> - 장치는 **LOW만 끌어내리고**, HIGH는 **풀업 저항(보통 4.7 kΩ)** 에 맡김
> - → SDA/SCL에 풀업 저항 필수

| 특성 | 의미 |
| :--- | :--- |
| **2선 + 풀업** | 배선 최소, 아무도 안 끌면 HIGH |
| **오픈 드레인** | 충돌 없이 여러 장치 공존 |
| **주소 기반** | 7-bit 또는 10-bit 주소로 대상 지정 |
| **속도 모드** | 100 kHz / 400 kHz / 1 MHz |

#### 2) I2C 프레임 시퀀스

![[Pasted image 20261023015604.png]]

| 요소 | 조건 |
| :--- | :--- |
| **START** | SCL HIGH 동안 SDA **HIGH → LOW** |
| **데이터 비트** | SCL LOW일 때 SDA 변경, SCL HIGH일 때 읽힘 |
| **주소 + R/W** | 주소 뒤에 읽기/쓰기 방향 비트가 붙음 |
| **ACK** | 수신 측이 **9번째 클럭** 동안 SDA를 LOW로 유지 |
| **STOP** | SCL HIGH 동안 SDA **LOW → HIGH** |
| **Repeated START** | STOP 없이 다시 START (쓰기 후 바로 읽기로 전환할 때) |

#### 3) I2C 주소 스캐너

- 주소 **0x03 ~ 0x77**에 차례로 0바이트 쓰기 시도
- **ACK가 돌아오면** 그 주소에 장치가 있다는 뜻

#### 4) HD44780 LCD 컨트롤러

> [!tip] 일단 이것만
> - 표시할 문자 → **DDRAM**
> - 사용자 정의 문자 → **CGRAM**

**제어 핀**

| 핀 | 0 | 1 |
| :--- | :--- | :--- |
| **RS** (Register Select) | 명령어 레지스터(IR) | 데이터 레지스터(DR) |
| **R/W** | 쓰기 | 읽기 |
| **E** (Enable) | **HIGH → LOW 하강 에지**에서 데이터 래치 | |

**내부 메모리**

| 메모리 | 설명 |
| :--- | :--- |
| **DDRAM** | 화면에 표시할 문자의 ASCII 코드 (80바이트). 1행 `0x00~0x0F`, 2행 `0x40~0x4F` |
| **CGROM** | 기본 문자의 5×8 폰트 패턴 (비휘발성 ROM) |
| **CGRAM** | 사용자 정의 폰트 비트맵 |

#### 5) PCF8574 I/O 확장기 (백팩)

> [!tip] 일단 이것만
> - PCF8574 = **8비트 I2C I/O 익스팬더** — I2C로 받은 1바이트를 8개 출력 핀으로 내보냄
> - 백팩이 LCD 핀에 배선되어 있으므로 **I2C 한 바이트 = LCD 제어선 8개**

**핀 매핑**

| PCF8574 | LCD | 설명 |
| :--- | :--- | :--- |
| `P0` | RS | 명령/데이터 구분 |
| `P1` | R/W | 쓰기 고정 (0) |
| `P2` | E | Enable 스트로브 |
| `P3` | BL | 백라이트 |
| `P4 ~ P7` | DB4 ~ DB7 | 데이터 상위 4비트 |

**4-bit 전송 방식**
- 데이터 핀은 **DB4~DB7 상위 4개만** 연결 (DB0~DB3 미사용)
- 한 글자(8비트) = **상위 니블 → 하위 니블** 두 번에 나눠 전송
- 각 니블마다 **E 핀을 1 → 0으로 펄스**(`Lcd1602_PulseEnable`)해야 LCD가 래치

### 2. 실습 요약

> [!example] 목표
> LPI2C1(100 kHz) + PCF8574 백팩으로 1602 LCD 초기화 → 1행 "Hello S32K3", 2행 카운터 출력

| 항목 | 내용 |
| :--- | :--- |
| 배선 | PTC6=SDA, PTC7=SCL (또는 PTD8/PTD9), 5V, GND |
| 설정 | LPI2C1 Master Mode, 100 kHz, 핀 Open-Drain |
| 슬레이브 주소 | `0x27` (`I2c_Scan()`으로 확인) |

**드라이버 모듈화** (`lcd1602.c / .h`)
- 전송 계층: `I2c_Lcd1602_Write`
- 응용 API: `Lcd1602_Init`, `Clear`, `SetCursor`, `Putc`, `Puts`

**4비트 모드 초기화 시퀀스 (KS0066U 규격)**

```
0x30 → 0x30 → 0x30 → 0x20 → Function Set → ...
```

**IPL vs MCAL** — 하위 전송 함수만 교체하여 동일 출력 검증
- IPL: `Lpi2c_Ip_MasterSendDataBlocking`
- MCAL: `I2c_SyncTransmit`

---

## 5주차 — 하드웨어 인터럽트 (NVIC, SIUL2 EIRQ, ICU)

### 1. 핵심 개념

#### 1) 폴링 vs 인터럽트

```
폴링:     main loop → 버튼 읽기 → 처리 → 버튼 읽기 → ...
인터럽트: main loop 실행 중 → 버튼 edge 발생 → ISR 진입 → 플래그 갱신 → main loop 복귀
```

| 방식 | 동작 | 장점 | 단점 |
| :--- | :--- | :--- | :--- |
| **폴링** | 루프에서 상태를 반복 확인 | 단순, 흐름 명확 | CPU 낭비, 늦게 반응 가능 |
| **인터럽트** | 이벤트 시 하드웨어가 ISR 호출 | 즉각 반응, CPU 효율 ↑ | 비동기라 설계가 까다로움 |

> [!important]
> 인터럽트는 응답성이 좋지만, **공유 변수와 실행 순서를 더 신중히** 다뤄야 한다.

#### 2) Cortex-M7 예외와 인터럽트

시스템 예외(Reset, NMI, HardFault)와 외부 인터럽트를 함께 처리하며, 관리 수단은 벡터 테이블 `__Vectors[]`

| 벡터 | 내용 |
| :--- | :--- |
| 0 | 초기 스택 포인터 (MSP) |
| 1 | Reset 핸들러 |
| 2 | NMI |
| 3 | HardFault |
| 0 ~ 15 | ARM 코어 예외 |
| **16 ~** | **외부 인터럽트 (IRQ 0~)** — NVIC 관리 |

| 개념 | 내용 |
| :--- | :--- |
| **진입** | 8개 레지스터를 자동으로 스택에 푸시한 뒤 핸들러 실행 |
| **복귀** | `EXC_RETURN` 특수값으로 복귀, 레지스터 자동 복원 |
| **Tail-chaining** | 연속된 인터럽트는 복원·재푸시를 생략해 빠르게 이어 처리 |
| **우선순위** | **숫자가 작을수록 높음**, 그룹·서브 우선순위로 프리엠션 제어 |

#### 3) NVIC

- 외부 인터럽트의 **enable, pending, priority** 관리
- 허용되어 있고 우선순위 조건이 맞으면 CPU가 ISR로 분기
- 빠르지만 공짜는 아님 — 문맥 일부를 스택에 저장

> [!warning] ISR은 짧게
> ISR이 길어지면 다른 인터럽트 응답과 main loop가 밀린다.
> → 긴 출력, LCD 갱신, 복잡한 계산은 ISR에서 피할 것

| 레지스터 | 역할 | SDK API |
| :--- | :--- | :--- |
| **ISER / ICER** | IRQ 개별 enable / disable | `NVIC_EnableIRQ()` / `NVIC_DisableIRQ()` |
| **ISPR / ICPR** | pending 설정 / 해제 | `NVIC_SetPendingIRQ()` / `NVIC_ClearPendingIRQ()` |
| **IPR** | 우선순위 설정 | `NVIC_SetPriority()` |

> [!note]
> RTD를 쓰면 등록 과정을 **Config Tools 생성 코드 + 콜백 등록**이 대신한다.

#### 4) S32K3 외부 핀 인터럽트 라우팅

- 외부 핀 입력은 **SIUL2**를 통해 인터럽트 이벤트로 라우팅
- **32개 EIRQ가 4개 NVIC 벡터 (IRQ 53~56)** 로 묶임
- RTD에서는 **`Siul2_Icu_Ip`** 드라이버 담당

#### 5) ISR 작성 원칙

- **LCD 출력과 `printf()`는 ISR 밖에서** 수행
- I2C LCD 출력은 blocking I2C write를 여러 번 포함 → 처리 시간이 긺

#### 6) 공유 변수와 `volatile`

- ISR과 main이 공유하는 변수는 **`volatile`** 로 선언
- "이 값은 현재 코드 흐름 밖에서 바뀔 수 있다"고 컴파일러에 알림

#### 7) 버튼 채터링

- 기계식 버튼은 한 번 눌러도 접점이 여러 번 붙었다 떨어짐
- 인터럽트에서는 **카운터가 여러 번 증가**하는 현상으로 드러남
- 해결: tick 차이로 일정 시간 안의 edge를 무시

```c
if ((now - last) < DEBOUNCE_TICKS) { return; }
last = now;
```

### 2. 실습 요약

> [!example] 목표
> USER_SW0(SW5)을 누를 때마다 인터럽트로 D13 LED 토글 + 4주차 LCD에 누적 카운터 표시

| 항목 | 내용 |
| :--- | :--- |
| 버튼 | `PTB26` (USER_SW0, SW5) → **SIUL2 EIRQ[13]** |
| 신호 특성 | 누를 때 High → **Rising Edge** |
| NVIC 벡터 | `SIUL_1_IRQn` (EIRQ 8~15 공유), 우선순위 10 |
| 핸들러 | `SIUL2_EXT_IRQ_8_15_ISR` |

**IPL — `chap05_interrupt_button_ipl`**
- 설정 모듈: Siul2_Port, Siul2_Dio, Siul2_Icu, IntCtrl_Ip
- 호출 순서:
  ```
  Siul2_Icu_Ip_Init() → EnableInterrupt() → EnableNotification() → IntCtrl_Ip_Init()
  ```

**MCAL — `chap05_interrupt_button_mcal`**
- 설정 모듈: Port, Dio, Icu, Platform
- 호출 순서:
  ```
  Port_Init() → Platform_Init() → Icu_Init() → Icu_EnableNotification() → Icu_EnableEdgeDetection()
  ```

**역할 분담**

| 위치 | 하는 일 |
| :--- | :--- |
| 콜백 `UserSw0_Callback()` | `g_press_count++`, `g_led_request ^= 1U` (volatile 변수 갱신만) |
| `main()` 루프 | 플래그 감지 → LED 토글, LCD 카운터 출력 |

→ 채터링 및 ISR 지연 없이 정상 구동 확인

---

## 6주차 — ADC (아날로그-디지털 변환)

### 1. 핵심 개념

#### 1) ADC의 역할

- 전압 같은 **연속적인 아날로그 값을 정수 코드**로 바꾼다
- **12-bit** → 0 ~ 4095

$$V = \frac{\text{code} \times V_{ref}}{4095}$$

- Vref = 3.3 V이면 **1 LSB ≈ 0.8 mV**

> [!important] ADC 값은 "정확한 전압"이 아니다
> **센서 · 회로 · 기준전압 · 샘플링 조건**의 결과다.
> 영향 요인: 기준전압 오차, 입력 노이즈, 샘플 시간, 회로 임피던스

#### 2) S32K3 ADC 모듈

- **ADC0 / ADC1** 두 개, 각 채널은 **특정 핀에 매핑**
- 변환 모드: **단발(One-shot)** / 연속 / 트리거(eMIOS · BCTU) → 이 장은 단발

> [!danger] 핀이 곧 채널
> 보드 가변저항(ADC_POT0, R293 10 kΩ)은 **PTA11**에 연결 → **ADC1 채널 S10**
> **ADC0이 아니다.** 채널은 고르는 게 아니라 핀이 결정한다.

#### 3) 샘플-홀드와 SAR

1. **샘플-홀드**: 입력 전압을 잠시 잡아 둔다
2. **SAR**: 내부 DAC와 비교기로 비트를 하나씩 결정

> [!warning]
> 입력 임피던스가 높거나 샘플 시간이 짧으면 커패시터가 덜 충전되어 **값이 흔들린다**.
> 디버깅 시 코드만 보지 말고 **핀 매핑, Vref, 입력 범위, 샘플링 주기, 전원/GND 노이즈**를 확인한다.

#### 4) 두 가지 평균

**소프트웨어 이동 평균** — 최근 N개 값의 평균 (N이 클수록 안정적이지만 응답이 느림, 실습은 N=8)

**하드웨어 묶음 평균** — `MCR[AVGEN]=1`이면 변환 1회에 같은 채널을 `MCR[AVGS]`회(4·8·16·32) 연속 변환해 평균 하나를 저장

| 구분 | 하드웨어 묶음 평균 | 소프트웨어 이동 평균 |
| :--- | :--- | :--- |
| 평균 대상 | 연속 변환한 8개 | 지난 8번 읽은 값 |
| 이전 값 기억 | 없음 | 있음 (원형 버퍼) |
| 줄이는 노이즈 | 순간 노이즈 | 읽기 사이 흔들림 |
| 비용 | 변환 시간 증가 | N번 읽어야 반영 |
| 구현 위치 | ADC 설정 | `adc_filter.c` |

```
ADC1_S10 → [HW 8회 묶음 평균] → hw_avg → [SW 8개 이동 평균] → filtered → mV
```

- 결과적으로 filtered 1개 = **8 × 8 = 64회 변환**
- 하드웨어 평균은 **ADC instance 단위** (그 ADC의 모든 채널에 적용)
- 빠른 신호(모터 전류 등)는 평균 횟수를 신중히

### 2. 실습 요약

> [!example] 목표
> 가변저항을 ADC1_S10으로 읽고(HW 평균 8회) → SW 이동 평균(N=8) 적용 → LCD에 **HW / MA / 전압** 표시

| 항목 | 내용 |
| :--- | :--- |
| 입력 | PTA11 = ADC1_S10, Software trigger, One-shot |
| 분해능 | **RESOLUTION_12**, 우측 정렬 |
| HW 평균 | Enable = true, **SAMPLES_8** |
| 전압 환산 | `mv = filtered * 5000 / 4095` (Vref는 실제 값 확인) |

> [!danger] 분해능 기본값은 14-bit
> 안 바꾸면 0~16383 범위 → **전압이 약 4배**로 표시된다.

**이동 평균 필터 핵심** — 합을 유지해 매번 N개를 다시 더하지 않음

```c
uint16_t AdcFilter_Update(AdcFilter_t *f, uint16_t sample)
{
    f->sum -= f->buf[f->index];          /* 가장 오래된 값 빼기 */
    f->buf[f->index] = sample;
    f->sum += sample;                    /* 새 값 더하기 */
    f->index = (uint8_t)((f->index + 1U) % ADC_FILTER_N);

    if (f->count < ADC_FILTER_N) { f->count++; }  /* 초기엔 채운 개수로 나눔 */
    return (uint16_t)(f->sum / f->count);
}
```

#### 실습 A — IPL (`chap06_adc_ipl`)

- `Adc_Sar_Ip_Init()` → `Adc_Sar_Ip_DoCalibration()` → 루프에서 읽기
- 완료 감지: **폴링** (ADC 인터럽트 미사용)

```c
Adc_Sar_Ip_StartConversion(ADC_INSTANCE, ADC_SAR_IP_CONV_CHAIN_NORMAL);
while ((Adc_Sar_Ip_GetStatusFlags(ADC_INSTANCE)
        & ADC_SAR_IP_STATUS_FLAG_NORMAL_ENDCHAIN) == 0U) { }
hw_avg = Adc_Sar_Ip_GetConvData(ADC_INSTANCE, ADC1_S10_CHANNEL_INDEX);
Adc_Sar_Ip_ClearStatusFlags(ADC_INSTANCE, ADC_SAR_IP_STATUS_FLAG_NORMAL_ENDCHAIN);
```

#### 실습 B — MCAL (`chap06_adc_mcal`)

- 구조: **하드웨어 유닛 → 채널 → 그룹** (`AdcGroup_POT`)
- 완료 감지: **콜백** `Adc1_Callback()` (ISR 안에서 실행)
- HW 평균은 AdcHwUnit의 **AdcNormalConvTimings 컨테이너를 추가**해야 켜짐 (`Conversion Time Once = true` 기본값일 때)

**콜백이 불리기까지 필요한 4가지**

```
Normal Interrupt Enable = true
 + Group Notification = Adc1_Callback
 + Platform: ADC1_IRQn → Adc_Sar_1_Isr 등록
 + 코드: Adc_EnableGroupNotification()   ← Adc_Init() 직후엔 꺼져 있음
```

```c
static volatile boolean AdcConvDone = FALSE;   /* ISR과 공유 → volatile */

void Adc1_Callback(void) { AdcConvDone = TRUE; }   /* 플래그만 세우고 끝 */

static uint16_t ReadPotAdcMcal(void)
{
    AdcConvDone = FALSE;
    Adc_StartGroupConversion(AdcGroup_POT);
    while (FALSE == AdcConvDone) { }
    (void)Adc_ReadGroup(AdcGroup_POT, AdcResultBuffer);
    return (uint16_t)AdcResultBuffer[0U];
}
```

초기화: `Platform_Init()` → `Port_Init()` → `Adc_Init()` → `Adc_SetupResultBuffer()` → `Adc_EnableGroupNotification()`

#### IPL vs MCAL 비교

| 항목 | IPL | MCAL |
| :--- | :--- | :--- |
| 변환 단위 | normal chain + channel index | group |
| 완료 감지 | 폴링 | 콜백 (ISR) |
| 결과 읽기 | `Adc_Sar_Ip_GetConvData()` | `Adc_ReadGroup()` |
| 이동 평균 필터 | `adc_filter.c` | **같은 파일 재사용** |

#### 관찰 포인트와 자주 나는 문제

- 가변저항을 멈추면 **MA가 HW보다 덜 흔들리고**, 빠르게 돌리면 **MA가 조금 늦게 따라간다**

| 증상 | 원인 → 조치 |
| :--- | :--- |
| 값이 0 또는 최대값 고정 | PTA11 / ADC1_S10 설정 확인 |
| 값이 4095 초과, 전압 약 4배 | 분해능 14-bit 기본값 → RESOLUTION_12 |
| 값이 심하게 흔들림 | HW 평균 미적용, Vref·배선 노이즈 확인 |
| (MCAL) while에서 멈춤 | 콜백 4가지 설정 중 누락 |
| (MCAL) 콜백은 오는데 계속 대기 | `AdcConvDone`에 **volatile 누락** |
| `undefined reference to Adc1_Callback` | 콜백 이름 불일치 또는 본체 없음 |

---

## 시험 대비 — 필기 기반 단독 출제 파트

### 1) C 비트 연산자 `[3주차 9.15]` — 중간고사 확정 출제

| 연산자 | 이름 | 동작 | 주 용도 |
| :--- | :--- | :--- | :--- |
| `&` | AND | 둘 다 1일 때만 1 | 비트 클리어, 추출/마스킹 |
| `\|` | OR | 하나라도 1이면 1 | 비트 세트 |
| `^` | XOR | 서로 다를 때만 1 | 비트 반전/토글 |
| `~` | NOT | 0↔1 반전 (1의 보수) | 마스크 반전 |
| `<<` | Left Shift | 왼쪽 이동, 빈자리 0 | N칸 = ×2ᴺ |
| `>>` | Right Shift | 오른쪽 이동 | N칸 = ÷2ᴺ (몫) |

**계산 예제**

```
5 & 3  →  0101 & 0011 = 0001 = 1
5 | 3  →  0101 | 0011 = 0111 = 7
5 ^ 3  →  0101 ^ 0011 = 0110 = 6
```

> [!caution]
> 메모 원문의 `5 ^ 3 = 0101(5)` 표기는 **오기**. 정답은 `0110 = 6`.

**시프트 예제**

```
5 << 2
  이동 전: 0000 0101  (5)
  이동 후: 0001 0100  (20)   ← 오른쪽 빈칸은 0

5 >> 2
  이동 전: 0000 0101  (5)
  이동 후: 0000 0001  (1)    ← 끝 비트는 버려짐

참고: 20 >> 2 → 0001 0100 → 0000 0101 = 5
```

---

### 2) SIUL2 구조체 주소 오프셋 계산 `[4주차 9.29]` — 출제 1순위

```c
typedef struct {
    uint8_t      RESERVED_0[4];
    __I uint32_t MIDR1;          /**< SIUL2 MCU ID Register #1, offset: 0x4 */
    __I uint32_t MIDR2;          /**< SIUL2 MCU ID Register #2, offset: 0x8 */
    uint8_t      RESERVED_1[4];
    __I uint32_t DISR0;          /**< offset: 0x10 */
} SIUL2_Type, *SIUL2_MemMapPtr;
```

**Base Address = `0x4029_0000`**

| 멤버 | 크기 | 오프셋 | 점유 주소 범위 |
| :--- | :--- | :--- | :--- |
| `RESERVED_0[4]` | 1B × 4 = 4B | `0x00` | `0x4029_0000 ~ 0x4029_0003` |
| `MIDR1` | 4B | `0x04` | `0x4029_0004 ~ 0x4029_0007` |
| `MIDR2` | 4B | `0x08` | `0x4029_0008 ~ 0x4029_000B` |
| `RESERVED_1[4]` | 1B × 4 = 4B | `0x0C` | `0x4029_000C ~ 0x4029_000F` |
| `DISR0` | 4B | **`0x10`** | `0x4029_0010 ~` |

> [!tip] 풀이 요령
> 이전 멤버의 **시작 주소 + 크기 = 다음 멤버의 시작 주소**.
> `uint8_t[4]` = 4바이트, `uint32_t` = 4바이트.

**시험 필수 다운로드 문서**
- S32K312 Data Sheet
- S32K312 Reference Manual
- S32K312EVB-Q172 회로도 (Schematic)

---

### 3) 하드웨어 체인과 LPI2C 분주 계산 `[5주차 10.6]`

**소프트웨어 추상화 계층 순서 (암기)**

```
C 포인터 직접 접근 → C 함수/라이브러리 → HAL → IP Layer (IPL) → AUTOSAR MCAL
```

*(수업 지향점: MCAL)*

**하드웨어 인터페이스 체인**

```
S32K312 MCU
   │  I2C 통신 (SDA, SCL 2선)
   ▼
PCF8574 (I/O 확장 백팩)
   │  8-bit 병렬 제어선 (RS, RW, E, DB4~7)
   ▼
HD44780 (LCD 컨트롤러)
   │  도트 매트릭스
   ▼
16×2 LCD 패널
```

**LPI2C 클럭 분주**

| 항목 | 값 |
| :--- | :--- |
| 입력 소스 | `AIPS_SLOW_CLK` → `LPI2C1_CLK` = **30 MHz** |
| Prescaler | `_DIV_16` |

$$\text{LPI2C 모듈 클럭} = \frac{30\,\text{MHz}}{16} = \mathbf{1.875\,\text{MHz}} \;(\approx 2\,\text{MHz})$$

→ 1.875 MHz를 기준으로 High/Low Period, Delay 카운트를 설정하여 **최종 100 kHz** I2C 보율 합성

---

### 4) 폴링 vs 인터럽트 정밀 비교 `[6주차 10.13]` — 서술형 대비

| 비교 기준 | 폴링 (Polling) | 인터럽트 (Interrupt) |
| :--- | :--- | :--- |
| **작동 메커니즘** | CPU가 주기적으로 레지스터를 직접 읽어 이벤트 발생 여부를 반복 확인 | 이벤트 발생 시 하드웨어가 CPU에 신호 → 실행 중인 루틴을 멈추고 ISR로 분기 |
| **CPU 효율** | 이벤트가 없어도 검사 루프를 돌아 연산 자원 낭비 | 이벤트가 없을 때는 본래 연산만 수행 → 낭비 없음 |
| **응답성 (Latency)** | Delay나 다른 연산 때문에 반응이 지연됨 | 우선순위에 따라 현재 작업을 선점 → 즉시 반응 |
| **설계·디버깅** | 순차적·결정론적이라 구현과 디버깅이 쉬움 | 비동기 특성상 `volatile`, 레이스 컨디션 등 동기화 설계가 복잡 |
