import React from "react";
import {Web3Props} from "../../hooks/providers/web3";
import {Button} from "../../components/Button";


interface LoginProps extends Web3Props {}

export const Login: React.FC<LoginProps> = ({
                                                error,
                                                address,
                                                logout,
                                                handleConnect,
                                            }) => {

    return (
        <section className={`grid place-items-center h-full w-full gap-3 px-6`}>
            <img className="w-64" src={`assets/logo-banner-transparent.png`} alt="Greenpill"/>
            <div className={`text-center uppercase`}>
                <h5>Welcome to the</h5>
                <h2>Greenpill App</h2>
            </div>
            <div className={`w-full`}>
                <Button
                    title={address ? "Logout" : "Login"}
                    onClick={address ? logout : handleConnect}
                />
                <p className="w-full text-red-500 h-10 line-clamp-2 text-center">{error}</p>
            </div>
        </section>
    );
};
