//#region src/generateMinBundleId.ts
const generateMinBundleId = () => {
	const timestamp = BigInt(Date.now());
	const timeHigh = Number(timestamp >> 16n & 4294967295n);
	const timeLow = Number(timestamp & 65535n);
	return `${timeHigh.toString(16).padStart(8, "0")}-${timeLow.toString(16).padStart(4, "0")}-${28672 .toString(16).padStart(4, "0")}-${32768 .toString(16).padStart(4, "0")}-000000000000`;
};
//#endregion
exports.generateMinBundleId = generateMinBundleId;
