#include <stdint.h>
uint8_t sum_bytes_v5(uint8_t *p, uint8_t n)   /* for(;;)+break, < */
{
    uint8_t sum = 0;
    uint8_t *e = p + n;
    for (;;) {
        if (p >= e) break;
        sum += *p++;
    }
    return sum;
}
uint8_t sum_bytes_v6(uint8_t *p, uint8_t n)   /* for(;;)+break, == */
{
    uint8_t sum = 0;
    uint8_t *e = p + n;
    for (;;) {
        if (p == e) break;
        sum += *p++;
    }
    return sum;
}
uint8_t sum_bytes_v7(uint8_t *p, uint8_t n)   /* while, sum then end declared */
{
    uint8_t sum = 0;
    uint8_t *e = p + n;
    while (p < e)
        sum += *p++;
    return sum;
}
uint8_t sum_bytes_v8(uint8_t *p, uint8_t n)   /* sum first in a separate variable */
{
    uint8_t s;
    uint8_t *e;
    s = 0;
    e = p + n;
    for (;;) {
        if (p >= e) break;
        s += *p++;
    }
    return s;
}
uint8_t sum_bytes_v9(uint8_t *p, uint8_t n)   /* loop on counter */
{
    uint8_t s = 0;
    uint8_t i;
    for (i = 0; i < n; i++)
        s += p[i];
    return s;
}
uint8_t sum_bytes_v10(uint8_t *p, uint8_t n)   /* do-while */
{
    uint8_t s = 0;
    uint8_t *e = p + n;
    do {
        s += *p++;
    } while (p < e);
    return s;
}
