//#region src/uuidv7.ts
const extractTimestampFromUUIDv7 = (uuid) => {
	const timestampHex = uuid.split("-").join("").slice(0, 12);
	return Number.parseInt(timestampHex, 16);
};
function createUUIDv7FromTimestampHex(timestampHex) {
	const randomBytes = new Uint8Array(10);
	crypto.getRandomValues(randomBytes);
	const randomHex = Array.from(randomBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
	const randA = randomHex.slice(0, 3);
	const randBHex = randomHex.slice(3, 19);
	const versionAndRandA = `7${randA}`;
	const variantAndFirstRandB = (128 | parseInt(randBHex.slice(0, 2), 16) & 63).toString(16).padStart(2, "0");
	return [
		timestampHex.slice(0, 8),
		timestampHex.slice(8, 12),
		versionAndRandA,
		variantAndFirstRandB + randBHex.slice(2, 4),
		randBHex.slice(4, 16)
	].join("-");
}
const createUUIDv7 = () => createUUIDv7FromTimestampHex(Date.now().toString(16).padStart(12, "0"));
const createUUIDv7WithSameTimestamp = (originalUuid) => {
	return createUUIDv7FromTimestampHex(originalUuid.split("-").join("").slice(0, 12));
};
//#endregion
export { createUUIDv7, createUUIDv7WithSameTimestamp, extractTimestampFromUUIDv7 };
