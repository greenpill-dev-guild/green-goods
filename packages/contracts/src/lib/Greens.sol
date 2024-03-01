// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

library GreensLib {
    bytes16 constant internal _ALPHABET = "0123456789abcdef";

    function getGreens(uint id) internal view returns(string memory, string memory) {
        bytes32 predictableRandom = keccak256(abi.encodePacked( id, address(this)));
        bytes3 value0 = bytes2(predictableRandom[0]) | ( bytes2(predictableRandom[1]) >> 8 ) | ( bytes3(predictableRandom[2]) >> 16 );
        bytes3 value1 = bytes2(predictableRandom[3]) | ( bytes2(predictableRandom[4]) >> 8 ) | ( bytes3(predictableRandom[5]) >> 16 );
        
        uint g = 120 + ((135*uint256(uint8(value0[0])))/255);
        uint rRandom = 25 + uint256(uint8(value0[1]))/10;
        uint r = rRandom + (g ** 2 * 5 / 1000) - (g * 8 / 10);
        uint bRandom = 230 + ((40 * uint256(uint8(value0[2])))/255);
        uint b = bRandom + (g ** 2 * 105 / 10000) - 3 * g;

        bytes3 newValue = uints2bytes(r,g,b);

        bytes memory buffer0 = new bytes(6);
        for (uint256 i = 0; i < 3; i++) {
            buffer0[i*2+1] = _ALPHABET[uint8(newValue[i]) & 0xf];
            buffer0[i*2] = _ALPHABET[uint8(newValue[i]>>4) & 0xf];
        }

        g = 120 + ((135*uint256(uint8(value1[0])))/255);
        rRandom = 89 + uint256(uint8(value1[1]))/10;
        r = rRandom + (g ** 2 * 5 / 1000) - (g * 8 / 10);
        bRandom = 230 + ((40 * uint256(uint8(value1[2])))/255);
        b = bRandom + (g ** 2 * 105 / 10000) - 3 * g;

        newValue = uints2bytes(r,g,b);

        bytes memory buffer1 = new bytes(6);
        for (uint256 i = 0; i < 3; i++) {
            buffer1[i*2+1] = _ALPHABET[uint8(newValue[i]) & 0xf];
            buffer1[i*2] = _ALPHABET[uint8(newValue[i]>>4) & 0xf];
        }
        return(string(buffer0),string(buffer1));
    }

    function uint2Bytes(uint num) internal pure returns(bytes2) {
        return abi.encodePacked(num)[31];
    }

    function uints2bytes(uint r, uint g, uint b) internal pure returns(bytes3) {
        return (uint2Bytes(r) | (uint2Bytes(g) >> 8) | (bytes3(uint2Bytes(b)) >> 16));
        
    }
}
