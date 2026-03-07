import ReactGA from "react-ga4";

const GA_MEASUREMENT_ID = "G-QK3TJQZQXV";

export const initGA = () => {
    ReactGA.initialize(GA_MEASUREMENT_ID);
};

export const logPageView = (path: string) => {
    ReactGA.send({ hitType: "pageview", page: path });
};
