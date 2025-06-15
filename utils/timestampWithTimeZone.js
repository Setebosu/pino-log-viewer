export default function timestampWithTimeZone() {
    const date = new Date();
    const tzOffset = date.getTimezoneOffset();
    return new Date(date - tzOffset * 60 * 1000).toISOString();
}