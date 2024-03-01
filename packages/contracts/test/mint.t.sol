// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {GPNCampaignNFT} from "../src/GPNCampaignNFT.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "erc6551/interfaces/IERC6551Registry.sol";
import "tokenbound/AccountProxy.sol";
import "erc6551/examples/simple/ERC6551Account.sol";

contract MintTest is Test {
    GPNCampaignNFT public gpnft;

    address payable public alice =
        payable(0x00000000000000000000000000000000000A11cE);
    address payable public bob =
        payable(0x0000000000000000000000000000000000000B0b);
    
    IERC6551Registry public registry6551 = 	IERC6551Registry(0x000000006551c19487814612e58FE06813775758);
    AccountProxy public implementation = AccountProxy(payable(0x55266d75D1a14E4572138116aF39863Ed6596E7F));
    address public actualImplementation = 0x41C8f39463A868d3A88af00cd0fe7102F30E44eC;
    address public entryPoint = 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789;

    address[] public team;
    string[] public capitals;


    

    function setUp() public {
        gpnft = new GPNCampaignNFT();
        team.push(alice);
        team.push(bob);
        team.push(0xa53A6fE2d8Ad977aD926C485343Ba39f32D3A3F6);
        
        capitals.push("cash");
        capitals.push("money");
        capitals.push("dollars");
        capitals.push("cheese");
    }

    function testMintAndDeploy() public {
        hoax(alice);
        gpnft.mintAndDeploy(capitals, team, 1709250389, 1709350000);
        uint tokenId = 0;
        address shouldBeAlice = gpnft.ownerOf(tokenId);
        assertEq(shouldBeAlice, alice, "Not Alice");
    }

    function testSCAccount() public {
        hoax(alice);
        gpnft.mintAndDeploy(capitals, team, 1709250389, 1709350000);
        uint tokenId = 0;
        //console2.log("tokenId ", tokenId);
        address scAddress = registry6551.account(
            address(implementation),
            bytes32(0x0), //salt
            11155111, //sepolia chain id 
            address(gpnft),
            tokenId
        );
        //console2.log("scAddress ", scAddress);
        ERC6551Account scAccount = ERC6551Account(payable(scAddress));
        address shouldBeAlice = scAccount.owner();
        //console2.log("shouldBeAlice ", shouldBeAlice);
        assertEq(shouldBeAlice, alice, "Not Alice 2");
    }

    function testTheArt() public {
        vm.prank(alice);
        gpnft.mintAndDeploy(capitals, team, 1709250389, 1709350000);
        uint tokenId = 0;

        
        vm.prank(alice);
        gpnft.initializeData(tokenId, 111222333444555);
        string memory art = gpnft.tokenURI(tokenId);
        console2.log(art);
        
        vm.prank(bob);
        gpnft.mintAndDeploy(capitals, team, 1709250389, 1709350000);
        tokenId = 1;
        art = gpnft.tokenURI(1);
        console2.log(art);
    }


    

}
