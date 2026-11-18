/* recon2.c — loop variants (reply_append_checksum + sum_bytes) */
#include <stdint.h>

/* --- reply_append_checksum: variants --- */
void reply_append_checksum_v1(char *buf)                        /* declarations: p then sum, separate body */
{
    char *p = buf;
    uint8_t sum = 0;
    while (p[1] != '$') {
        sum += (uint8_t)*p;
        p++;
    }
    *p = (char)((sum & 0x0F) | '0');
}
void reply_append_checksum_v2(char *buf)                        /* for */
{
    char *p = buf;
    uint8_t sum = 0;
    for (; p[1] != '$'; p++)
        sum += (uint8_t)*p;
    *p = (char)((sum & 0x0F) | '0');
}
void reply_append_checksum_v3(char *buf)                        /* sum declared first */
{
    uint8_t sum = 0;
    char *p = buf;
    while (p[1] != '$')
        sum += (uint8_t)*p++;
    *p = (char)((sum & 0x0F) | '0');
}
void reply_append_checksum_v4(char *buf)                        /* separate body + p++ after */
{
    uint8_t sum = 0;
    char *p = buf;
    while (p[1] != '$') {
        sum += (uint8_t)*p;
        p++;
    }
    *p = (char)((sum & 0x0F) | '0');
}

/* --- sum_bytes: variants --- */
uint8_t sum_bytes_v1(uint8_t *p, uint8_t n)         /* sum declared first */
{
    uint8_t sum = 0;
    uint8_t *end = p + n;
    while (p < end)
        sum += *p++;
    return sum;
}
uint8_t sum_bytes_v2(uint8_t *p, uint8_t n)         /* separate body */
{
    uint8_t sum = 0;
    uint8_t *end = p + n;
    while (p < end) {
        sum += *p;
        p++;
    }
    return sum;
}
uint8_t sum_bytes_v3(uint8_t *p, uint8_t n)         /* for */
{
    uint8_t sum = 0;
    uint8_t *end = p + n;
    for (; p < end; p++)
        sum += *p;
    return sum;
}
uint8_t sum_bytes_v4(uint8_t *p, uint8_t n)         /* condition != */
{
    uint8_t sum = 0;
    uint8_t *end = p + n;
    while (p != end)
        sum += *p++;
    return sum;
}
