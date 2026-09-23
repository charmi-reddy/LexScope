import Hero from '../components/landing/Hero'
import HowItWorks from '../components/landing/HowItWorks'
import Capabilities from '../components/landing/Capabilities'
import ExampleAnalysis from '../components/landing/ExampleAnalysis'
import PrivacySection from '../components/landing/PrivacySection'
import CtaBanner from '../components/landing/CtaBanner'
import DisclaimerNote from '../components/ui/DisclaimerNote'

export default function LandingPage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <Capabilities />
      <ExampleAnalysis />
      <PrivacySection />
      <CtaBanner />
      <div className="border-t border-rule bg-paper-deep/50">
        <div className="container-page py-5">
          <DisclaimerNote />
        </div>
      </div>
    </>
  )
}
