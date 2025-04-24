import { useUrl } from "@/hooks/useUrl";
import { NotFound } from "@/components/not-found";
import { Address } from "viem";
import { MainSection } from "@/components/layout/main-section";

export default function MissionPage() {
  return (
    <MainSection>
      <h1 className="text-lg">Mission</h1>
      <p>
        The Taiko Security Council's mission is to safeguard the protocol through proactive security measures that
        maintain the highest industry standards while ensuring seamless alignment with Ethereum's security framework.
        The council leverages its members' expertise to continuously improve security practices specifically tailored
        for Taiko's ZK-rollup architecture.
      </p>
      <h1 className="mt-4 text-lg">Core Values</h1>
      <p>
        <ul className="list-inside list-decimal">
          <li>
            <b>Ethereum Alignment:</b> We maintain unwavering commitment to Ethereum's security standards and
            developments, ensuring Taiko's security framework evolves in harmony with the broader Ethereum ecosystem.
          </li>
          <li>
            <b>Collective Expertise:</b> We leverage the diverse technical knowledge and industry experience of our
            members, fostering collaborative decision-making to address complex and ever evolving security challenges.
          </li>
          <li>
            <b>Security Innovation:</b> We maintain vigilant oversight while driving forward-thinking security
            solutions, continuously monitoring industry developments and adapting our approach to stay ahead of emerging
            challenges in the rollup space.
          </li>
          <li>
            <b>Balanced Governance:</b> We ensure swift and decisive security responses while maintaining appropriate
            transparency with the community, striking the optimal balance between urgent security needs and inclusive
            protocol governance.
          </li>
        </ul>
      </p>
    </MainSection>
  );
}
