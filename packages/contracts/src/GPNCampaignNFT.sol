// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "tokenbound/lib/erc6551/interfaces/IERC6551Registry.sol";
import "tokenbound/AccountProxy.sol";
import "base64/base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract GPNCampaignNFT is ERC721Enumerable{
    using Strings for uint256;

    //for production deployment consider alloing one or more of these to be updateable
    IERC6551Registry constant public REGISTRY_6551 = 	IERC6551Registry(0x000000006551c19487814612e58FE06813775758);
    AccountProxy  constant public IMPLEMENTATION = AccountProxy(payable(0x55266d75D1a14E4572138116aF39863Ed6596E7F));
    address constant public ACTUAL_IMPLEMENTATION = 0x41C8f39463A868d3A88af00cd0fe7102F30E44eC;
    bytes16 constant internal _ALPHABET = "0123456789abcdef";
    uint public idCounter;
    struct CertInfo {
        uint hypercertId;
        string[] capitals;
        address[] team;
        uint startDate;
        uint endDate;
        bool initialized;
    }
    mapping(uint => CertInfo) public traitData;

    constructor() ERC721("green pill network campaign", "GPNC"){
        //
    }

    //how to gate this so only app users can mint
    function mintAndDeploy(string[] calldata _capitals, address[] calldata _team, uint _startDate, uint _endDate) external returns(address){
        //for predictable user accounts, the token ID must be derived from the user address
        uint id = idCounter;
        address tba = getTbaForNftId(id);
        if(_exists(id)) {
            return tba;
        } else {
            _mint(msg.sender, id);
            address tba2 = REGISTRY_6551.createAccount(
                address(IMPLEMENTATION),
                bytes32(0x0), //salt
                11155111, //sepolia chain id 
                address(this),
                id
            );
            require(tba == tba2, "account and createAccount mismatch");
            AccountProxy(payable(tba2)).initialize(ACTUAL_IMPLEMENTATION);

            traitData[id].startDate = _startDate;
            traitData[id].endDate = _endDate;

            for(uint i = 0; i < _capitals.length; i++) {
                traitData[id].capitals.push(_capitals[i]);
            }

            for(uint i = 0; i < _team.length; i++) {
                traitData[id].team.push(_team[i]);
            }

            idCounter++;
            return tba;
        }
    }

    function initializeData(uint _id, uint _hypercertId) public {
        require(msg.sender == ownerOf(_id), "not owner");
        traitData[_id].hypercertId = _hypercertId;
        traitData[_id].initialized = true;
    }

    function tokenURI(uint id) public override view returns(string memory){
        require(_exists(id), "does not exist");
        (string memory green0, string memory green1) = getGreens(id);
        string memory hyperId = "";
        string memory description = getDescription(id);
        string memory team = getTeamString(id);
        string memory capitals = getCapitalsString(id);

        if(traitData[id].initialized) {
            hyperId = string(
                abi.encodePacked(
                    '{"trait_type": "Hypercert ID", "value":"',
                traitData[id].hypercertId.toString() ,
                '"},'
                )
            );
        }

        string memory traits = string(
            abi.encodePacked(
                '"attributes": [',
                hyperId,
                team,
                capitals,
                '{"trait_type": "Start Date", "value": "',
                traitData[id].startDate.toString(),
                '"},{"trait_type": "EndDate", "value": "',
                traitData[id].endDate.toString(),
                '"}], '
                )
            );

        

        string memory art = Base64.encode(abi.encodePacked(
                '<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">',
                '<g>',
                '<ellipse transform="rotate(45.4221 156.414 232.524)" stroke="#',
                green0,
                '" ry="42.55656" rx="35.20466" id="svg_1" cy="232.52439" cx="156.41417" fill="#',
                green0,
                '"/>',
                '<path transform="rotate(-45.6451 179.923 209.098)" stroke="#',
                green0,
                '" d="m146.42156,173.72335l67.00211,0l0,70.74998l-67.00211,0l0,-70.74998z" opacity="undefined" fill="#',
                green0,
                '"/>',
                '<ellipse transform="rotate(45.4221 232.468 155.389)" stroke="#',
                green1,
                '" ry="42.55656" rx="37.44838" id="svg_3" cy="155.38882" cx="232.4676" fill="#',
                green1,
                '"/>',
                '<path transform="rotate(-45.6451 212.188 176.092)" stroke="#',
                green1,
                '" d="m181.18874,138.70539l61.99878,0l0,74.77298l-61.99878,0l0,-74.77298z" opacity="undefined" fill="#',
                green1,
                '"/>',
                '<rect transform="rotate(44.6005 193.285 151.826)" stroke="#ffffff" height="61.77912" width="5.60052" y="120.93639" x="190.48437" fill="#ffffff"/>',
                '<rect transform="rotate(44.6005 149.201 199.747)" stroke="#ffffff" height="51.64358" width="6.48007" y="173.92549" x="145.96107" fill="#ffffff"/>',
                '<path stroke="#ffffff" d="m219.8938,128.88792l-3.9367,-3.70736c1.23677,-1.08461 8.72076,-5.532 15.93633,-5.59708c-6.85868,3.88149 -10.82235,8.23974 -11.99964,9.30444z" fill="#ffffff"/>',
                '</g>',
                '</svg>'
            ));

        return
            string(
                abi.encodePacked(
                    "data:application/json;base64,",
                    Base64.encode(
                        bytes(
                            abi.encodePacked(
                                '{"name":"',
                                id.toString(),
                                '", "description":"',
                                description,
                                '", "external_url":"https://greenpillapp.com/',//add address
                                id.toString(), //this would need to be added to frontend
                                '", ',
                                traits,
                                '"image": "',
                                "data:image/svg+xml;base64,",
                                art,
                                '"}'
                            )
                        )
                    )
                )
            );
    }

    function exists(uint id) public view returns(bool){
        return(_exists(id));
    }

    function getTeamString(uint id)public view returns(string memory){
        //address[] memory teamArray = traitData[id].team;
        string memory team = "";
        for(uint i = 0; i < traitData[id].team.length; i++){
            team = string(abi.encodePacked(team,
                '{"trait_type": "Team Member ',
                i.toString(),
                '", "value": "',
                Strings.toHexString(traitData[id].team[i]),
                '"},'
            ));
        }
        return(team);    
    }

    function getCapitalsString(uint id)public view returns(string memory){
        //string[] memory capitalsArray = traitData[id].capitals;
        string memory capitals = "";
        for(uint i = 0; i < traitData[id].capitals.length; i++){
            capitals = string(abi.encodePacked(capitals,
                '{"trait_type": "Capital ',
                i.toString(),
                '", "value": "',
                traitData[id].capitals[i],
                '"},'
            ));
        }    
        return(capitals);
    }

    function getDescription(uint id) public view returns(string memory) {
        return(string(abi.encodePacked(
            'This campaign is represented by hypercert ID ',
            traitData[id].hypercertId.toString(),
            ' with a start date of ',
            traitData[id].startDate.toString(),
            ' and an end date of ',
            traitData[id].endDate.toString()
        )));
    }

    function getTbaForNftId(uint _id) public view returns(address) {
        address tba = REGISTRY_6551.account(
            address(IMPLEMENTATION),
            bytes32(0x0), //salt
            11155111, //sepolia chain id 
            address(this),
            _id
        );
        return(tba);
    }

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
