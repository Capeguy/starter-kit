'use client'

import Image from 'next/image'
import { ArrowRight } from 'lucide-react'

import { LinkButton } from '@acme/ui/link-button'
import { RestrictedFooter } from '@acme/ui/restricted-footer'

import { AUTHED_ROOT_ROUTE, LOGIN_ROUTE } from '~/constants'
import { env } from '~/env'
import { FeatureItem } from './feature-item'
import { LandingPageHeader } from './header'
import { LandingSection, SectionBody, SectionHeader } from './section'

interface LandingPageComponentProps {
  appName: string
  isAuthed: boolean
}

/**
 * Exported for testing.
 */
export const LandingPageComponent = ({
  isAuthed,
  appName,
}: LandingPageComponentProps) => {
  const ctaLink = isAuthed ? AUTHED_ROOT_ROUTE : LOGIN_ROUTE

  return (
    <div className="flex flex-1 flex-col">
      <div className="bg-muted">
        <div className="container mx-auto px-4">
          <LandingPageHeader isAuthed={isAuthed} />
          <div className="flex flex-col py-14 md:flex-row md:py-22">
            <div className="flex flex-1 flex-col">
              <h1 className="text-foreground text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
                Build production ready applications in minutes.
              </h1>
              <p className="text-foreground mt-4 text-base">
                StarterApp is our baseline application created by StarterKit.
                You can explore it to get a sense of basic functions and
                interactions.
              </p>
              <div className="mt-10">
                <LinkButton
                  href={ctaLink}
                  endContent={<ArrowRight className="size-5" />}
                >
                  Explore StarterApp
                </LinkButton>
              </div>
            </div>
            <div className="flex flex-1 justify-end" aria-hidden="true">
              <Image
                src="/assets/landing-banner.svg"
                alt="StarterApp hero"
                width={480}
                height={400}
              />
            </div>
          </div>
        </div>
      </div>
      <LandingSection>
        <SectionHeader>Our application features</SectionHeader>
        <div className="mt-16 grid grid-cols-1 gap-x-10 gap-y-16 md:grid-cols-2 lg:grid-cols-3">
          <FeatureItem
            title="Example feature 1"
            description="This is a description of one of the features in the application"
          />
          <FeatureItem
            title="Example feature 2"
            description="This is a description of one of the features in the application"
          />
          <FeatureItem
            title="Example feature 3"
            description="This is a description of one of the features in the application"
          />
        </div>
      </LandingSection>
      <LandingSection className="bg-muted">
        <div className="flex flex-col items-center gap-6 py-14 md:gap-12 md:py-22 lg:flex-row lg:gap-30">
          <div className="flex flex-1 flex-col gap-4">
            <SectionHeader>Another call to action</SectionHeader>
            <SectionBody>
              Sign in with your email address, and start building your app
              immediately. It's free, and requires no onboarding or approvals.
            </SectionBody>
            <div className="mt-10">
              <LinkButton href={ctaLink}>Get started</LinkButton>
            </div>
          </div>
          <div className="flex-1" aria-hidden="true">
            <Image
              src="/assets/landing-banner.svg"
              alt="StarterApp hero"
              width={480}
              height={400}
            />
          </div>
        </div>
      </LandingSection>
      {env.NEXT_PUBLIC_SHOW_OGP_BRANDING && (
        <LandingSection>
          <SectionHeader>
            All the government tools you need to manage your workflow
          </SectionHeader>
          <SectionBody>
            Check out the <strong>Open Government Products Suite</strong>, and
            if you are a public officer you can mix and match from our set of
            productivity and collaboration tools.{' '}
            <a
              href="https://reports.open.gov.sg/products"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 inline-flex items-center gap-0.5 underline underline-offset-4"
            >
              Full list of OGP products
              <ArrowRight className="size-5" />
            </a>
          </SectionBody>
        </LandingSection>
      )}
      <LandingSection
        classNames={{
          section: 'bg-foreground',
          inner: 'items-center gap-8',
        }}
      >
        {env.NEXT_PUBLIC_SHOW_OGP_BRANDING && (
          <Image
            alt="ogp brand logo"
            src="/assets/restricted-landing-ogp-logo.svg"
            aria-hidden
            width={56}
            height={56}
          />
        )}
        <SectionHeader className="text-background">
          Start building your app now
        </SectionHeader>
        <LinkButton href={ctaLink}>Get started</LinkButton>
      </LandingSection>
      {env.NEXT_PUBLIC_SHOW_OGP_BRANDING && (
        <RestrictedFooter
          appName={appName}
          navLinks={[
            // Add more nav links as application requires, e.g.
            // { href: 'https://example.com', label: 'Guide' },
            // { href: '/privacy', label: 'Privacy' },
            // { href: '/terms-of-use', label: 'Terms of use' },
            {
              href: 'https://go.gov.sg/report-vulnerability',
              label: 'Report vulnerability',
            },
          ]}
        />
      )}
    </div>
  )
}
